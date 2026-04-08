import * as vscode from 'vscode';
import { PipTokenPanel } from './webview/PipTokenPanel';
import { initDb, closeDb } from './data/db';
import { ClaudeCodeWatcher } from './parsing/claudeCodeWatcher';
import { setResyncHandler } from './webview/messageHandler';
import { logger } from './utils/logger';

let watcher: ClaudeCodeWatcher | null = null;
let dbReady: Promise<void> | null = null;

export function activate(context: vscode.ExtensionContext) {
  // Initialize database (async — sql.js loads WASM)
  // Store the promise so commands can await it before querying
  dbReady = initDb(context).then(() => {
    logger.info('Database ready');

    // Start file watcher only after DB is ready
    try {
      watcher = new ClaudeCodeWatcher();
      watcher.start(() => {
        logger.info('New token data available');
        PipTokenPanel.pushLiveUpdate();
      });
      setResyncHandler(() => {
        watcher?.rescan();
        PipTokenPanel.pushLiveUpdate();
      });
    } catch (err) {
      logger.error('Failed to start watcher', err);
    }
  }).catch(err => {
    logger.error('Failed to initialize database', err);
  });

  const openPanel = vscode.commands.registerCommand('pipToken.openPanel', async () => {
    await dbReady;
    PipTokenPanel.createOrShow(context);
  });

  const syncDashboard = vscode.commands.registerCommand('pipToken.syncDashboard', async () => {
    await dbReady;
    PipTokenPanel.createOrShow(context);
    // TODO: navigate to sync modal (post-v1)
  });

  context.subscriptions.push(openPanel, syncDashboard);
}

export function deactivate() {
  if (watcher) {
    watcher.stop();
    watcher = null;
  }
  closeDb();
}
