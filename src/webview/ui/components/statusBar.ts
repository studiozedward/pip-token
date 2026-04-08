// --- Interface for status bar data (matches extension-side contract) ---

interface StatusBarData {
  isPeak: boolean;
  contextUsed: number;
  contextMax: number;
  burnRate: number | 'LEARNING' | 'STALE';
  weeklyTokens: number;
  weeklyCostMinor: number;
  currency: string;
}

// --- Formatting (browser-side reimplementations) ---

function formatCompact(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`;
  }
  return n.toString();
}

function formatBurnRate(n: number): string {
  return `${formatCompact(n)}/MIN`;
}

// --- Currency formatting for WK cost display ---

const CURRENCY_SYMBOL_MAP: Record<string, string> = {
  USD: '$',
  GBP: '\u00A3',
  EUR: '\u20AC',
  CAD: 'C$',
  AUD: 'A$',
  JPY: '\u00A5',
};

function getCurrencySymbolLocal(currency: string): string {
  return CURRENCY_SYMBOL_MAP[currency] ?? currency;
}

function formatCostMinor(minorUnits: number, currency: string): string {
  const symbol = getCurrencySymbolLocal(currency);
  if (currency === 'JPY') {
    // JPY has no sub-units; minor = major
    return `${symbol}${minorUnits}`;
  }
  const major = (minorUnits / 100).toFixed(2);
  return `${symbol}${major}`;
}

// --- Module-level state ---

let statusData: StatusBarData | null = null;

export function updateStatusBarData(data: StatusBarData): void {
  statusData = data;
  const el = document.querySelector('.statusbar');
  if (el) renderStatusBarContent(el as HTMLElement);
}

export function renderStatusBar(container: HTMLElement): void {
  container.className = 'statusbar';
  renderStatusBarContent(container);
}

function renderStatusBarContent(container: HTMLElement): void {
  if (!statusData) {
    container.innerHTML = `
      <div class="statusbar-segment">--</div>
      <div class="statusbar-segment" style="flex: 1.3;">CTX --/--</div>
      <div class="statusbar-segment" style="flex: 1.2;">BURN --</div>
      <div class="statusbar-segment" style="flex: 1;">WK --</div>
    `;
    return;
  }

  const peakClass = statusData.isPeak ? ' peak' : '';
  const peakLabel = statusData.isPeak ? 'PEAK' : 'OFF-PEAK';
  const ctxUsed = formatCompact(statusData.contextUsed);
  const ctxMax = formatCompact(statusData.contextMax);
  const burn = typeof statusData.burnRate === 'number' ? formatBurnRate(statusData.burnRate) : '--';
  const wkCost = formatCostMinor(statusData.weeklyCostMinor, statusData.currency);

  container.innerHTML = `
    <div class="statusbar-segment${peakClass}">${peakLabel}</div>
    <div class="statusbar-segment" style="flex: 1.3;">CTX ${ctxUsed}/${ctxMax}</div>
    <div class="statusbar-segment" style="flex: 1.2;">BURN ${burn}</div>
    <div class="statusbar-segment" style="flex: 1;">WK ${wkCost}</div>
  `;
}
