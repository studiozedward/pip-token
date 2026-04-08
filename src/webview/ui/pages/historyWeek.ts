import { sendToExtension } from '../../messageBus';
import { renderMascot } from '../components/mascotPanel';
import { renderBarChart } from '../components/barChart';
import { renderAdvisory } from '../components/advisoryBox';
import { HISTORY_CARD_DESCRIPTIONS } from '../config/statDescriptions';

// --- Interfaces (match extension-side contract) ---

interface BarData {
  label: string;
  peakValue: number;
  offpeakValue: number;
  limitHits: number;
}

interface HistoryCards {
  total: number;
  peakPct?: number;
  limitHits: number;
  avgPerDay: number;
}

interface StatsHistoryPayload {
  pageId: string;
  periodLabel: string;
  canGoBack: boolean;
  canGoForward: boolean;
  bars: BarData[];
  averageLine: number | null;
  cards: HistoryCards;
  statusBar: unknown;
  advisory?: string | null;
}

// --- Formatting (browser-side) ---

function formatWithCommas(n: number): string {
  return n.toLocaleString('en-US');
}

// --- Card definitions ---

interface CardDef {
  label: string;
  key: string;
  format: (cards: HistoryCards) => string;
}

const CARD_DEFS: CardDef[] = [
  { label: 'TOTAL', key: 'TOTAL', format: (c) => formatWithCommas(c.total) },
  { label: 'PEAK %', key: 'PEAK %', format: (c) => c.peakPct !== undefined ? `${c.peakPct}%` : '--' },
  { label: 'LIMIT HITS', key: 'LIMIT HITS', format: (c) => c.limitHits.toString() },
  { label: 'AVG/DAY', key: 'AVG/DAY', format: (c) => formatWithCommas(c.avgPerDay) },
];

// --- Module-level state ---

let selectedCard = 'TOTAL';
let currentData: StatsHistoryPayload | null = null;
let containerRef: HTMLElement | null = null;
let periodOffset = 0;

// --- Render ---

export function renderHistoryWeek(container: HTMLElement): void {
  containerRef = container;
  periodOffset = 0;

  // Request data from extension
  sendToExtension({ type: 'requestPageData', payload: { pageId: 'history.week', periodOffset } });

  container.innerHTML = `
    <div class="period-nav" id="period-nav-week">
      <span class="period-nav-arrow" id="nav-back-week">\u25C4</span>
      <span class="period-nav-label" id="period-label-week">--</span>
      <span class="period-nav-arrow disabled" id="nav-forward-week">\u25BA</span>
    </div>
    <div id="chart-history-week" class="chart-area"><span class="learning-state">LOADING...</span></div>
    <div class="cards" id="cards-history-week"></div>
    <div class="page-body">
      <div class="mascot" id="mascot-history-week"></div>
    </div>
    <div class="advisory"></div>
  `;

  // Wire up nav arrows
  const backArrow = container.querySelector('#nav-back-week') as HTMLElement;
  const forwardArrow = container.querySelector('#nav-forward-week') as HTMLElement;

  if (backArrow) {
    backArrow.addEventListener('click', () => {
      periodOffset--;
      sendToExtension({ type: 'requestPageData', payload: { pageId: 'history.week', periodOffset } });
    });
  }

  if (forwardArrow) {
    forwardArrow.addEventListener('click', () => {
      if (currentData && !currentData.canGoForward) return;
      periodOffset++;
      sendToExtension({ type: 'requestPageData', payload: { pageId: 'history.week', periodOffset } });
    });
  }

  // Render cards in learning state
  renderCards();

  // Render mascot
  const mascotEl = container.querySelector('#mascot-history-week') as HTMLElement;
  if (mascotEl) {
    renderMascot(mascotEl, 'history', HISTORY_CARD_DESCRIPTIONS[selectedCard] ?? '');
  }

  // If we already have data, apply it
  if (currentData) {
    applyData();
  }
}

// --- Update from extension ---

export function updateHistoryWeek(payload: unknown): void {
  currentData = payload as StatsHistoryPayload;
  applyData();
  if (containerRef) renderAdvisory(containerRef, currentData.advisory);
}

function applyData(): void {
  if (!currentData || !containerRef) return;

  // Update period label
  const labelEl = containerRef.querySelector('#period-label-week') as HTMLElement;
  if (labelEl) {
    labelEl.textContent = currentData.periodLabel;
  }

  // Update forward arrow enabled/disabled
  const forwardArrow = containerRef.querySelector('#nav-forward-week') as HTMLElement;
  if (forwardArrow) {
    if (currentData.canGoForward) {
      forwardArrow.classList.remove('disabled');
    } else {
      forwardArrow.classList.add('disabled');
    }
  }

  // Render chart
  const chartEl = containerRef.querySelector('#chart-history-week') as HTMLElement;
  if (chartEl) {
    renderBarChart(chartEl, {
      bars: currentData.bars,
      averageLine: currentData.averageLine,
      yAxisLabel: 'TOKENS',
    });
  }

  // Update card values
  renderCards();
}

function renderCards(): void {
  if (!containerRef) return;
  const cardsEl = containerRef.querySelector('#cards-history-week') as HTMLElement;
  if (!cardsEl) return;

  cardsEl.innerHTML = '';

  for (const def of CARD_DEFS) {
    const card = document.createElement('div');
    card.className = `card${def.key === selectedCard ? ' active' : ''}`;
    card.dataset.card = def.key;

    const valueText = currentData ? def.format(currentData.cards) : '--';
    const valueClass = currentData ? '' : ' learning-state';

    card.innerHTML = `
      <div class="card-label">${def.label}</div>
      <div class="card-value${valueClass}">${valueText}</div>
    `;

    card.addEventListener('click', () => {
      selectCard(def.key);
    });

    cardsEl.appendChild(card);
  }
}

function selectCard(key: string): void {
  selectedCard = key;

  if (!containerRef) return;

  // Update card active states
  const cards = containerRef.querySelectorAll('#cards-history-week .card');
  for (const card of cards) {
    const htmlCard = card as HTMLElement;
    if (htmlCard.dataset.card === key) {
      htmlCard.classList.add('active');
    } else {
      htmlCard.classList.remove('active');
    }
  }

  // Update mascot description
  const mascotEl = containerRef.querySelector('#mascot-history-week') as HTMLElement;
  if (mascotEl) {
    renderMascot(mascotEl, 'history', HISTORY_CARD_DESCRIPTIONS[key] ?? '');
  }
}
