import { sendToExtension } from '../../messageBus';

interface PlanOption {
  value: string;
  label: string;
  price: string;
}

const PLAN_OPTIONS: PlanOption[] = [
  { value: 'free', label: 'FREE', price: '$0/mo' },
  { value: 'pro', label: 'PRO', price: '$20/mo' },
  { value: 'max_5x', label: 'MAX 5X', price: '$100/mo' },
  { value: 'max_20x', label: 'MAX 20X', price: '$200/mo' },
];

const CURRENCY_OPTIONS = ['USD', 'GBP', 'EUR', 'CAD', 'AUD', 'JPY'];

// Module-level state
let currentStep = 1;
let selectedTier = 'pro';
let selectedCurrency = detectCurrency();

function detectCurrency(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    if (locale.includes('GB')) return 'GBP';
    if (locale.includes('US') || locale.startsWith('en')) return 'USD';
    if (locale.includes('EU') || locale.includes('DE') || locale.includes('FR')) return 'EUR';
    if (locale.includes('CA')) return 'CAD';
    if (locale.includes('AU')) return 'AUD';
    if (locale.includes('JP')) return 'JPY';
  } catch {
    // fallback
  }
  return 'USD';
}

function getAssetUrl(key: string): string {
  const assets = (window as unknown as Record<string, unknown>).pipTokenAssets as Record<string, string> | undefined;
  return assets?.[key] ?? '';
}

function renderStep(container: HTMLElement): void {
  switch (currentStep) {
    case 1: renderWelcome(container); break;
    case 2: renderPlanTier(container); break;
    case 3: renderCurrency(container); break;
    case 4: renderReady(container); break;
  }
}

function renderWelcome(container: HTMLElement): void {
  container.innerHTML = `
    <div style="padding: 20px 0; text-align: center;">
      <div class="bigwelcome">WELCOME TO PIP-TOKEN</div>
      <div class="subwelcome">Tracking your Claude Code usage one token at a time</div>
      <div style="padding: 14px 0;">
        <img src="${getAssetUrl('owlAbout')}" alt="Pip-Token owl" style="width: 120px;">
      </div>
      <div class="continuebtn" id="onboarding-continue">CONTINUE</div>
    </div>
  `;

  const btn = container.querySelector('#onboarding-continue') as HTMLElement | null;
  if (btn) {
    btn.addEventListener('click', () => {
      currentStep = 2;
      renderStep(container);
    });
  }
}

function renderPlanTier(container: HTMLElement): void {
  const rows = PLAN_OPTIONS.map(opt => {
    const isActive = opt.value === selectedTier;
    return `<div class="stat${isActive ? ' active' : ''}" data-tier="${opt.value}">
      <span>${opt.label}</span>
      <span style="font-size: 11px; color: ${isActive ? 'var(--green-darker)' : 'var(--green-dim)'};">${opt.price}</span>
    </div>`;
  }).join('');

  container.innerHTML = `
    <div style="padding: 20px 0;">
      <div class="section-title" style="text-align: center; font-size: 12px; letter-spacing: 2px; padding-bottom: 12px;">SELECT YOUR PLAN TIER</div>
      <div class="statlist planlist">
        ${rows}
      </div>
      <div class="continuebtn" id="onboarding-continue" style="margin-top: 16px;">CONTINUE</div>
    </div>
  `;

  // Tier selection
  const stats = container.querySelectorAll('[data-tier]');
  stats.forEach(el => {
    el.addEventListener('click', () => {
      selectedTier = el.getAttribute('data-tier') ?? 'pro';
      renderPlanTier(container);
    });
  });

  const btn = container.querySelector('#onboarding-continue') as HTMLElement | null;
  if (btn) {
    btn.addEventListener('click', () => {
      sendToExtension({ type: 'updateSettings', payload: { key: 'plan_tier', value: selectedTier } });
      currentStep = 3;
      renderStep(container);
    });
  }
}

function renderCurrency(container: HTMLElement): void {
  container.innerHTML = `
    <div style="padding: 20px 0;">
      <div class="section-title" style="text-align: center; font-size: 12px; letter-spacing: 2px; padding-bottom: 12px;">CONFIRM YOUR CURRENCY</div>
      <div style="text-align: center; padding: 16px 0;">
        <div style="font-size: 20px; font-weight: 700; letter-spacing: 2px; padding-bottom: 8px;" id="currency-display">${selectedCurrency}</div>
        <div style="font-size: 11px; color: var(--green-mid); padding-bottom: 12px;">Auto-detected from your system locale</div>
      </div>
      <div style="display: flex; gap: 8px; justify-content: center;">
        <div class="continuebtn" id="currency-yes" style="flex: 1; max-width: 160px;">YES, USE ${selectedCurrency}</div>
        <div class="continuebtn" id="currency-change" style="flex: 1; max-width: 160px; border-color: var(--green-dim); color: var(--green-dim);">CHANGE</div>
      </div>
      <div id="currency-picker" style="display: none; padding-top: 12px; text-align: center;"></div>
    </div>
  `;

  const yesBtn = container.querySelector('#currency-yes') as HTMLElement | null;
  const changeBtn = container.querySelector('#currency-change') as HTMLElement | null;
  const pickerArea = container.querySelector('#currency-picker') as HTMLElement | null;

  if (yesBtn) {
    yesBtn.addEventListener('click', () => {
      sendToExtension({ type: 'updateSettings', payload: { key: 'currency', value: selectedCurrency } });
      currentStep = 4;
      renderStep(container);
    });
  }

  if (changeBtn && pickerArea) {
    changeBtn.addEventListener('click', () => {
      const optionsHtml = CURRENCY_OPTIONS
        .map(c => `<option value="${c}"${c === selectedCurrency ? ' selected' : ''}>${c}</option>`)
        .join('');
      pickerArea.innerHTML = `
        <select class="project-selector" id="currency-select" style="font-size: 14px; padding: 4px 10px;">${optionsHtml}</select>
        <div class="continuebtn" id="currency-confirm" style="margin-top: 10px;">CONFIRM</div>
      `;
      pickerArea.style.display = 'block';

      const selectEl = pickerArea.querySelector('#currency-select') as HTMLSelectElement | null;
      const confirmBtn = pickerArea.querySelector('#currency-confirm') as HTMLElement | null;

      if (selectEl) {
        selectEl.addEventListener('change', () => {
          selectedCurrency = selectEl.value;
        });
      }

      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
          sendToExtension({ type: 'updateSettings', payload: { key: 'currency', value: selectedCurrency } });
          currentStep = 4;
          renderStep(container);
        });
      }
    });
  }
}

function renderReady(container: HTMLElement): void {
  container.innerHTML = `
    <div style="padding: 20px 0; text-align: center;">
      <div class="bigwelcome" style="font-size: 28px;">READY</div>
      <div class="subwelcome" style="padding: 12px 20px 0; line-height: 1.6;">
        Pip-Token will now track your usage. Some metrics will show LEARNING until enough data accumulates.
      </div>
      <div style="padding: 14px 0;">
        <img src="${getAssetUrl('owlLive')}" alt="Pip-Token owl" style="width: 100px;">
      </div>
      <div class="continuebtn" id="onboarding-start">START</div>
    </div>
  `;

  const btn = container.querySelector('#onboarding-start') as HTMLElement | null;
  if (btn) {
    btn.addEventListener('click', () => {
      sendToExtension({ type: 'completeOnboarding' });
    });
  }
}

export function renderOnboarding(container: HTMLElement): void {
  currentStep = 1;
  selectedTier = 'pro';
  selectedCurrency = detectCurrency();
  renderStep(container);
}
