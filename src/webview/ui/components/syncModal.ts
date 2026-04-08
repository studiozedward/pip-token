import { sendToExtension } from '../../messageBus';

let overlayEl: HTMLElement | null = null;

export function showSyncModal(lastSyncLabel: string | null): void {
  // Remove any existing modal
  hideSyncModal();

  overlayEl = document.createElement('div');
  overlayEl.className = 'sync-overlay';

  const syncDisplay = lastSyncLabel ?? 'Never synced';

  overlayEl.innerHTML = `
    <div class="sync-modal">
      <div class="sync-modal-title">DASHBOARD SYNC</div>
      <div class="glossary-p" style="padding-bottom: 6px;">
        Open Anthropic's Settings \u2192 Usage page and enter the percentages shown there.
      </div>
      <div class="glossary-p" style="padding-bottom: 8px; color: var(--green-mid); font-size: 10px;">
        https://console.anthropic.com/settings/usage
      </div>
      <div class="sync-input-group">
        <div class="sync-input-label">5-HOUR USAGE %</div>
        <input type="number" class="sync-input" id="sync-fivehour" min="0" max="100" placeholder="0" />
      </div>
      <div class="sync-input-group">
        <div class="sync-input-label">WEEKLY USAGE %</div>
        <input type="number" class="sync-input" id="sync-weekly" min="0" max="100" placeholder="0" />
      </div>
      <div class="glossary-p" style="padding-top: 6px; color: var(--green-dim); font-size: 10px;">
        Last sync: ${syncDisplay}
      </div>
      <div id="sync-error" class="sync-error" style="display: none;"></div>
      <div class="sync-buttons">
        <button class="sync-btn cancel" id="sync-cancel">CANCEL</button>
        <button class="sync-btn" id="sync-save">SAVE SYNC</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlayEl);

  // Event listeners
  const cancelBtn = overlayEl.querySelector('#sync-cancel') as HTMLElement;
  const saveBtn = overlayEl.querySelector('#sync-save') as HTMLElement;
  const fivehourInput = overlayEl.querySelector('#sync-fivehour') as HTMLInputElement;
  const weeklyInput = overlayEl.querySelector('#sync-weekly') as HTMLInputElement;

  cancelBtn.addEventListener('click', () => {
    hideSyncModal();
  });

  // Close on backdrop click
  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) {
      hideSyncModal();
    }
  });

  saveBtn.addEventListener('click', () => {
    const errorEl = overlayEl?.querySelector('#sync-error') as HTMLElement | null;
    const fivehourVal = parseFloat(fivehourInput.value);
    const weeklyVal = parseFloat(weeklyInput.value);

    // Validate
    if (isNaN(fivehourVal) || isNaN(weeklyVal)) {
      if (errorEl) {
        errorEl.textContent = 'ENTER BOTH PERCENTAGES (0\u2013100)';
        errorEl.style.display = 'block';
      }
      return;
    }

    if (fivehourVal < 0 || fivehourVal > 100 || weeklyVal < 0 || weeklyVal > 100) {
      if (errorEl) {
        errorEl.textContent = 'VALUES MUST BE BETWEEN 0 AND 100';
        errorEl.style.display = 'block';
      }
      return;
    }

    sendToExtension({
      type: 'dashboardSync',
      payload: { fivehourPct: fivehourVal, weeklyPct: weeklyVal },
    });

    hideSyncModal();
  });
}

export function hideSyncModal(): void {
  if (overlayEl && overlayEl.parentNode) {
    overlayEl.parentNode.removeChild(overlayEl);
  }
  overlayEl = null;
}
