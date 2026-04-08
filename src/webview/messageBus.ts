// Message types from webview → extension
export interface WebviewMessage {
  type: 'requestPageData' | 'navigateTo' | 'setProjectFilter' | 'manualLimitHit' | 'dashboardSync' | 'updateSettings' | 'resetHistory' | 'completeOnboarding';
  payload?: unknown;
}

// Message types from extension → webview
export interface ExtensionMessage {
  type: 'pageData' | 'liveUpdate' | 'activeSessionsChanged' | 'settingsChanged' | 'firstRunDetected';
  payload?: unknown;
}

// Webview-side: acquire the VS Code API once
declare function acquireVsCodeApi(): {
  postMessage(message: WebviewMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
};

let vscodeApi: ReturnType<typeof acquireVsCodeApi> | null = null;

export function getVsCodeApi() {
  if (!vscodeApi) {
    vscodeApi = acquireVsCodeApi();
  }
  return vscodeApi;
}

export function sendToExtension(message: WebviewMessage): void {
  getVsCodeApi().postMessage(message);
}

export function onExtensionMessage(handler: (message: ExtensionMessage) => void): void {
  window.addEventListener('message', (event: MessageEvent) => {
    handler(event.data as ExtensionMessage);
  });
}
