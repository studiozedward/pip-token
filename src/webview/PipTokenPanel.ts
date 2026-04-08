import * as vscode from 'vscode';
import { handleWebviewMessage, computeLiveUpdate } from './messageHandler';
import { getSetting } from '../data/repositories/settingsRepo';
import { logger } from '../utils/logger';

export class PipTokenPanel {
  public static readonly viewType = 'pipToken.panel';
  private static instance: PipTokenPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];

  public static createOrShow(context: vscode.ExtensionContext) {
    const column = vscode.ViewColumn.Beside;

    if (PipTokenPanel.instance) {
      PipTokenPanel.instance.panel.reveal(column);
      PipTokenPanel.checkFirstRun();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      PipTokenPanel.viewType,
      'Pip-Token',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'out'),
          vscode.Uri.joinPath(context.extensionUri, 'assets'),
        ],
      }
    );

    PipTokenPanel.instance = new PipTokenPanel(panel, context.extensionUri);
    PipTokenPanel.checkFirstRun();
  }

  /** Send an arbitrary message to the webview panel, if it exists. */
  public static sendToWebview(message: unknown): void {
    if (PipTokenPanel.instance) {
      try {
        PipTokenPanel.instance.panel.webview.postMessage(message);
      } catch (err) {
        logger.error('Failed to send message to webview', err);
      }
    }
  }

  /** Check if this is a first run and notify the webview if onboarding is needed. */
  public static checkFirstRun(): void {
    try {
      const completed = getSetting('onboarding_completed_at');
      if (!completed) {
        PipTokenPanel.sendToWebview({ type: 'firstRunDetected' });
      }
    } catch (err) {
      logger.error('Error checking first run status', err);
    }
  }

  /** Compute and push a live update to the webview panel. */
  public static pushLiveUpdate(): void {
    try {
      const update = computeLiveUpdate();
      if (update !== null) {
        PipTokenPanel.sendToWebview(update);
      }
    } catch (err) {
      logger.error('Failed to push live update', err);
    }
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;

    this.panel.webview.html = this.getHtmlForWebview();
    this.panel.iconPath = vscode.Uri.joinPath(extensionUri, 'assets', 'owl-live.png');

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      (message: { type: string; payload?: unknown }) => {
        try {
          const result = handleWebviewMessage(message);
          if (result !== null) {
            this.panel.webview.postMessage(result);
          }
        } catch (err) {
          logger.error('Error processing webview message', err);
        }
      },
      null,
      this.disposables
    );
  }

  private dispose() {
    PipTokenPanel.instance = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) { d.dispose(); }
    }
  }

  private getHtmlForWebview(): string {
    const webview = this.panel.webview;
    const nonce = getNonce();

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'out', 'webview.js')
    );

    const stylesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'out', 'styles.css')
    );

    // Make asset URIs available to webview JS
    const owlLiveUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'assets', 'owl-live.png'));
    const owlStatsUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'assets', 'owl-stats.png'));
    const owlHistoryUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'assets', 'owl-history.png'));
    const owlTipsUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'assets', 'owl-ideas.png'));
    const owlAboutUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'assets', 'owl-about.png'));

    return `<!DOCTYPE html>
<html lang="en" style="color-scheme: dark;">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https:;">
  <link href="${stylesUri}" rel="stylesheet">
  <title>Pip-Token</title>
</head>
<body>
  <div class="frame">
    <div class="scanlines"></div>
    <div class="inner" id="app"></div>
  </div>
  <script nonce="${nonce}">
    window.pipTokenAssets = {
      owlLive: "${owlLiveUri}",
      owlStats: "${owlStatsUri}",
      owlHistory: "${owlHistoryUri}",
      owlTips: "${owlTipsUri}",
      owlAbout: "${owlAboutUri}"
    };
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
