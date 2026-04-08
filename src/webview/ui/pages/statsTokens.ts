import { sendToExtension } from '../../messageBus';
import { renderMascot } from '../components/mascotPanel';
import { renderBarChart } from '../components/barChart';
import { renderAdvisory } from '../components/advisoryBox';
import { STATS_CARD_DESCRIPTIONS } from '../config/statDescriptions';

// --- Interfaces (match extension-side contract) ---

interface BarData {
  label: string;
  peakValue: number;
  offpeakValue: number;
  limitHits: number;
}

interface StatsCards {
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
  cards: StatsCards;
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
  format: (cards: StatsCards) => string;
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

// --- Render ---

export function renderStatsTokens(container: HTMLElement): void {
  containerRef = container;

  // Request data from extension
  sendToExtension({ type: 'requestPageData', payload: { pageId: 'stats.tokens' } });

  container.innerHTML = `
    <div class="section-title">7-DAY ROLLING TOKEN USAGE</div>
    <div id="chart-stats-tokens" class="chart-area"><span class="learning-state">LOADING...</span></div>
    <div class="cards" id="cards-stats-tokens"></div>
    <div id="limit-hit-area"></div>
    <div class="page-body">
      <div class="mascot" id="mascot-stats-tokens"></div>
    </div>
    <div class="advisory"></div>
  `;

  // Render cards in learning state
  renderCards();

  // Render limit hit button with inline confirm
  const limitArea = container.querySelector('#limit-hit-area') as HTMLElement;
  if (limitArea) {
    const btn = document.createElement('button');
    btn.className = 'limit-hit-btn';
    btn.textContent = '+ LOG LIMIT HIT';
    let confirmTimer: ReturnType<typeof setTimeout> | null = null;
    btn.addEventListener('click', () => {
      if (btn.dataset.confirming === 'true') {
        // Second click — confirm
        btn.dataset.confirming = '';
        btn.textContent = '+ LOG LIMIT HIT';
        btn.style.borderColor = '';
        btn.style.color = '';
        if (confirmTimer) clearTimeout(confirmTimer);
        sendToExtension({ type: 'manualLimitHit' });
      } else {
        // First click — ask to confirm
        btn.dataset.confirming = 'true';
        btn.textContent = 'CONFIRM?';
        btn.style.borderColor = 'var(--alarm-red)';
        btn.style.color = 'var(--alarm-red)';
        confirmTimer = setTimeout(() => {
          btn.dataset.confirming = '';
          btn.textContent = '+ LOG LIMIT HIT';
          btn.style.borderColor = '';
          btn.style.color = '';
        }, 3000);
      }
    });
    limitArea.appendChild(btn);
  }

  // Render mascot with default description
  const mascotEl = container.querySelector('#mascot-stats-tokens') as HTMLElement;
  if (mascotEl) {
    renderMascot(mascotEl, 'stats', STATS_CARD_DESCRIPTIONS[selectedCard] ?? '');
  }

  // If we already have data (re-render), apply it
  if (currentData) {
    applyData();
  }
}

// --- Update from extension ---

export function updateStatsTokens(payload: unknown): void {
  currentData = payload as StatsHistoryPayload;
  applyData();
  if (containerRef) renderAdvisory(containerRef, currentData.advisory);
}

function applyData(): void {
  if (!currentData || !containerRef) return;

  // Render chart
  const chartEl = containerRef.querySelector('#chart-stats-tokens') as HTMLElement;
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
  const cardsEl = containerRef.querySelector('#cards-stats-tokens') as HTMLElement;
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
  const cards = containerRef.querySelectorAll('#cards-stats-tokens .card');
  for (const card of cards) {
    const htmlCard = card as HTMLElement;
    if (htmlCard.dataset.card === key) {
      htmlCard.classList.add('active');
    } else {
      htmlCard.classList.remove('active');
    }
  }

  // Update mascot description
  const mascotEl = containerRef.querySelector('#mascot-stats-tokens') as HTMLElement;
  if (mascotEl) {
    renderMascot(mascotEl, 'stats', STATS_CARD_DESCRIPTIONS[key] ?? '');
  }
}
