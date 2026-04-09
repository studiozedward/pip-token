import { renderMascot } from '../components/mascotPanel';
import { sendToExtension } from '../../messageBus';
import { updateStatusBarData, setSyncing } from '../components/statusBar';
import { showSyncModal } from '../components/syncModal';

interface StatusBarData {
  isPeak: boolean;
  contextUsed: number;
  contextMax: number;
  burnRate: number | null;
  weeklyTokens: number;
  weeklyCostMinor: number;
  currency: string;
}

interface AboutInfoData {
  version: string;
  dbConnected: boolean;
  sessionsTracked: number;
  turnsTracked: number;
  lastSync: string | null;
  syncAgeLabel: string | null;
}

interface AboutInfoPayload {
  pageId: string;
  settings?: Record<string, string>;
  info?: AboutInfoData;
  statusBar?: StatusBarData;
}

interface CollapsibleItem {
  header: string;
  content: string;
}

const PLAN_OPTIONS = [
  { value: 'free', label: 'FREE' },
  { value: 'pro', label: 'PRO' },
  { value: 'max_5x', label: 'MAX 5X' },
  { value: 'max_20x', label: 'MAX 20X' },
];

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD' },
  { value: 'GBP', label: 'GBP' },
  { value: 'EUR', label: 'EUR' },
  { value: 'CAD', label: 'CAD' },
  { value: 'AUD', label: 'AUD' },
  { value: 'JPY', label: 'JPY' },
];

const HOW_IT_WORKS: CollapsibleItem[] = [
  {
    header: 'Why does it say LEARNING?',
    content: 'Some metrics need warmup data before they can show meaningful numbers. BURN RATE needs 5 minutes of activity. EST. TIME TO LIMIT needs at least one limit hit. Keep using Claude Code and they will fill in automatically.',
  },
  {
    header: 'How are active projects detected?',
    content: "Pip-Token watches Claude Code's session files in ~/.claude/projects/ and considers a project active if its log file was modified in the last 2 hours.",
  },
  {
    header: 'Why should I sync with the dashboard?',
    content: 'Pip-Token only sees Claude Code usage. If you also use Claude.ai chat or the mobile app, those tokens count against the same limits. Syncing with the dashboard lets Pip-Token account for that other usage.',
  },
  {
    header: 'Why are some numbers labelled EST.?',
    content: 'The EST. prefix means estimated. Cost figures show API-equivalent prices \u2014 subscription users are not actually charged per token.',
  },
  {
    header: 'Why does cache assume 5 minutes?',
    content: "Claude offers both 5-minute and 1-hour prompt caches. Pip-Token assumes 5 minutes because it is the most common and we cannot reliably detect which is active.",
  },
];

// Module-level state
let currentSettings: Record<string, string> = {};
let containerRef: HTMLElement | null = null;
let lastSyncLabel: string | null = null;

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'AUTO';
  } catch {
    return 'AUTO';
  }
}

function buildSettingsDropdown(key: string, options: Array<{ value: string; label: string }>, currentValue: string): string {
  const optionsHtml = options
    .map(opt => `<option value="${opt.value}"${opt.value === currentValue ? ' selected' : ''}>${opt.label}</option>`)
    .join('');
  return `<select class="project-selector" data-setting-key="${key}">${optionsHtml}</select>`;
}

function buildToggle(key: string, isOn: boolean): string {
  const cls = isOn ? 'toggle on' : 'toggle';
  const label = isOn ? 'ON' : 'OFF';
  return `<span class="${cls}" data-toggle-key="${key}">${label}</span>`;
}

function buildCollapsibles(): string {
  return HOW_IT_WORKS.map((item, i) => `
    <div class="collapsible-header" data-collapsible="${i}">${item.header}</div>
    <div class="collapsible-content" data-collapsible-content="${i}">${item.content}</div>
  `).join('');
}

function populateFromPayload(container: HTMLElement, payload: AboutInfoPayload): void {
  if (payload.settings) {
    currentSettings = { ...payload.settings };
  }

  // Update dropdowns
  const planSelect = container.querySelector('[data-setting-key="plan_tier"]') as HTMLSelectElement | null;
  if (planSelect && currentSettings['plan_tier']) {
    planSelect.value = currentSettings['plan_tier'];
  }

  const currencySelect = container.querySelector('[data-setting-key="currency"]') as HTMLSelectElement | null;
  if (currencySelect && currentSettings['currency']) {
    currencySelect.value = currentSettings['currency'];
  }

  // Update toggles
  const blipToggle = container.querySelector('[data-toggle-key="blip_sound"]') as HTMLElement | null;
  if (blipToggle) {
    const isOn = currentSettings['blip_sound'] === 'on';
    blipToggle.className = isOn ? 'toggle on' : 'toggle';
    blipToggle.textContent = isOn ? 'ON' : 'OFF';
  }

  // Clear any active spinners / confirm boxes
  const resyncArea = container.querySelector('#resync-confirm') as HTMLElement | null;
  if (resyncArea) resyncArea.innerHTML = '';
  const resetArea = container.querySelector('#reset-confirm') as HTMLElement | null;
  if (resetArea) resetArea.innerHTML = '';

  // Update info section
  if (payload.info) {
    const info = payload.info;
    lastSyncLabel = info.syncAgeLabel;

    const versionEl = container.querySelector('#about-version') as HTMLElement | null;
    if (versionEl) versionEl.textContent = info.version;

    const dbEl = container.querySelector('#about-db') as HTMLElement | null;
    if (dbEl) {
      dbEl.textContent = info.dbConnected ? 'CONNECTED' : 'NOT CONNECTED';
      dbEl.style.color = info.dbConnected ? '' : 'var(--alarm-red)';
    }

    const sessionsEl = container.querySelector('#about-sessions') as HTMLElement | null;
    if (sessionsEl) sessionsEl.textContent = String(info.sessionsTracked);

    const turnsEl = container.querySelector('#about-turns') as HTMLElement | null;
    if (turnsEl) turnsEl.textContent = String(info.turnsTracked);

    const syncEl = container.querySelector('#about-last-sync') as HTMLElement | null;
    if (syncEl) syncEl.textContent = info.syncAgeLabel ?? 'NEVER';
  }
}

function attachEventListeners(container: HTMLElement): void {
  // Dropdown changes
  const dropdowns = container.querySelectorAll('select[data-setting-key]');
  dropdowns.forEach(el => {
    el.addEventListener('change', () => {
      const select = el as HTMLSelectElement;
      const key = select.getAttribute('data-setting-key') ?? '';
      currentSettings[key] = select.value;
      sendToExtension({ type: 'updateSettings', payload: { key, value: select.value } });
    });
  });

  // Toggle clicks
  const toggles = container.querySelectorAll('[data-toggle-key]');
  toggles.forEach(el => {
    el.addEventListener('click', () => {
      const toggle = el as HTMLElement;
      const key = toggle.getAttribute('data-toggle-key') ?? '';
      const isCurrentlyOn = toggle.classList.contains('on');
      const newValue = isCurrentlyOn ? 'off' : 'on';
      toggle.className = isCurrentlyOn ? 'toggle' : 'toggle on';
      toggle.textContent = isCurrentlyOn ? 'OFF' : 'ON';
      currentSettings[key] = newValue;
      sendToExtension({ type: 'updateSettings', payload: { key, value: newValue } });
    });
  });

  // Collapsible headers
  const headers = container.querySelectorAll('[data-collapsible]');
  headers.forEach(el => {
    el.addEventListener('click', () => {
      const header = el as HTMLElement;
      const idx = header.getAttribute('data-collapsible') ?? '';
      const content = container.querySelector(`[data-collapsible-content="${idx}"]`) as HTMLElement | null;
      if (content) {
        const isOpen = header.classList.contains('open');
        header.classList.toggle('open', !isOpen);
        content.classList.toggle('open', !isOpen);
      }
    });
  });

  // Action buttons
  const syncBtn = container.querySelector('#action-sync') as HTMLElement | null;
  if (syncBtn) {
    syncBtn.addEventListener('click', () => {
      showSyncModal(lastSyncLabel);
    });
  }

  const limitBtn = container.querySelector('#action-limit-hit') as HTMLElement | null;
  if (limitBtn) {
    let confirmTimer: ReturnType<typeof setTimeout> | null = null;
    limitBtn.addEventListener('click', () => {
      if (limitBtn.dataset.confirming === 'true') {
        limitBtn.dataset.confirming = '';
        limitBtn.textContent = 'LOG LIMIT HIT NOW';
        limitBtn.style.borderColor = '';
        limitBtn.style.color = '';
        if (confirmTimer) clearTimeout(confirmTimer);
        sendToExtension({ type: 'manualLimitHit' });
      } else {
        limitBtn.dataset.confirming = 'true';
        limitBtn.textContent = 'CONFIRM?';
        limitBtn.style.borderColor = 'var(--alarm-red)';
        limitBtn.style.color = 'var(--alarm-red)';
        confirmTimer = setTimeout(() => {
          limitBtn.dataset.confirming = '';
          limitBtn.textContent = 'LOG LIMIT HIT NOW';
          limitBtn.style.borderColor = '';
          limitBtn.style.color = '';
        }, 3000);
      }
    });
  }

  const resyncBtn = container.querySelector('#action-resync') as HTMLElement | null;
  if (resyncBtn) {
    resyncBtn.addEventListener('click', () => {
      showResyncConfirm(container);
    });
  }

  const resetBtn = container.querySelector('#action-reset') as HTMLElement | null;
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      showResetConfirm(container);
    });
  }
}

function showResyncConfirm(container: HTMLElement): void {
  const confirmArea = container.querySelector('#resync-confirm') as HTMLElement | null;
  if (!confirmArea) return;

  confirmArea.innerHTML = `
    <div class="confirm-box confirm-box--green">
      This will rebuild all data from Claude Code's log files. Manual limit hits will be lost.
      <div class="sync-buttons">
        <button class="sync-btn cancel" id="resync-cancel">CANCEL</button>
        <button class="sync-btn" id="resync-yes">RESYNC</button>
      </div>
    </div>
  `;

  const cancelBtn = confirmArea.querySelector('#resync-cancel') as HTMLElement | null;
  const yesBtn = confirmArea.querySelector('#resync-yes') as HTMLElement | null;

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      confirmArea.innerHTML = '';
    });
  }

  if (yesBtn) {
    yesBtn.addEventListener('click', () => {
      setSyncing(true);
      sendToExtension({ type: 'resyncData' });
      confirmArea.innerHTML = `<div class="action-spinner">RESYNCING\u2026</div>`;
    });
  }
}

function showResetConfirm(container: HTMLElement): void {
  const confirmArea = container.querySelector('#reset-confirm') as HTMLElement | null;
  if (!confirmArea) return;

  confirmArea.innerHTML = `
    <div class="confirm-box">
      ARE YOU SURE? This will permanently erase all data with no rebuild.
      <div class="sync-buttons">
        <button class="sync-btn cancel" id="reset-cancel">CANCEL</button>
        <button class="sync-btn" id="reset-yes" style="border-color: var(--alarm-red); color: var(--alarm-red);">YES, CLEAR</button>
      </div>
    </div>
  `;

  const cancelBtn = confirmArea.querySelector('#reset-cancel') as HTMLElement | null;
  const yesBtn = confirmArea.querySelector('#reset-yes') as HTMLElement | null;

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      confirmArea.innerHTML = '';
    });
  }

  if (yesBtn) {
    yesBtn.addEventListener('click', () => {
      sendToExtension({ type: 'resetHistory' });
      confirmArea.innerHTML = `<div class="action-spinner action-spinner--red">CLEARING\u2026</div>`;
    });
  }
}

export function renderAboutInfo(container: HTMLElement): void {
  containerRef = container;

  const planValue = currentSettings['plan_tier'] ?? 'pro';
  const currencyValue = currentSettings['currency'] ?? 'USD';
  const blipOn = currentSettings['blip_sound'] === 'on';
  const tz = detectTimezone();

  container.innerHTML = `
    <div class="page-body">
      <div class="about-left">
        <div class="section-title">SETTINGS</div>
        <div class="aboutgrid">
          <div class="aboutgrid-key">PLAN TIER</div>
          <div class="aboutgrid-value">${buildSettingsDropdown('plan_tier', PLAN_OPTIONS, planValue)}</div>
          <div class="aboutgrid-key">CURRENCY</div>
          <div class="aboutgrid-value">${buildSettingsDropdown('currency', CURRENCY_OPTIONS, currencyValue)}</div>
          <div class="aboutgrid-key">TIMEZONE</div>
          <div class="aboutgrid-value">${tz}</div>
          <div class="aboutgrid-key">BLIP SOUND</div>
          <div class="aboutgrid-value">${buildToggle('blip_sound', blipOn)}</div>
        </div>

        <div class="section-title" style="padding-top: 12px;">ACTIONS</div>
        <button class="action-btn" id="action-sync">SYNC WITH DASHBOARD</button>
        <button class="action-btn" id="action-limit-hit">LOG LIMIT HIT NOW</button>
        <button class="action-btn" id="action-resync">RESYNC DATA</button>
        <div id="resync-confirm"></div>
        <button class="action-btn danger" id="action-reset">CLEAR ALL DATA</button>
        <div id="reset-confirm"></div>

        <div class="section-title" style="padding-top: 12px;">INFO</div>
        <div class="aboutgrid">
          <div class="aboutgrid-key">VERSION</div>
          <div class="aboutgrid-value" id="about-version">${__APP_VERSION__}</div>
          <div class="aboutgrid-key">DATABASE</div>
          <div class="aboutgrid-value" id="about-db">NOT CONNECTED</div>
          <div class="aboutgrid-key">SESSIONS</div>
          <div class="aboutgrid-value" id="about-sessions">0</div>
          <div class="aboutgrid-key">TURNS</div>
          <div class="aboutgrid-value" id="about-turns">0</div>
          <div class="aboutgrid-key">LAST SYNC</div>
          <div class="aboutgrid-value" id="about-last-sync">NEVER</div>
        </div>

        <div class="section-title" style="padding-top: 12px;">HOW IT WORKS</div>
        ${buildCollapsibles()}

        <div class="page-footer">Found a bug? @StudioZedward on X</div>
      </div>
      <div class="mascot" id="mascot-about"></div>
    </div>
  `;

  const mascotEl = container.querySelector('#mascot-about') as HTMLElement;
  if (mascotEl) {
    renderMascot(mascotEl, 'about', `Pip-Token v${__APP_VERSION__} \u2014 An open source project by Studio Zedward. Have feedback? Message me on X at @StudioZedward.`);
  }

  attachEventListeners(container);

  sendToExtension({ type: 'requestPageData', payload: { pageId: 'about.info' } });
}

export function updateAboutInfo(payload: AboutInfoPayload): void {
  if (payload.statusBar) {
    updateStatusBarData(payload.statusBar);
  }

  if (containerRef) {
    populateFromPayload(containerRef, payload);
  }
}
