import { sendToExtension } from '../../messageBus';
import { renderMascot } from '../components/mascotPanel';
import { renderBarChart } from '../components/barChart';
import { renderAdvisory } from '../components/advisoryBox';
import { COST_CARD_DESCRIPTIONS } from '../config/statDescriptions';

// --- Interfaces (match extension-side contract) ---

interface BarData {
  label: string;
  peakValue: number;
  offpeakValue: number;
  limitHits: number;
}

interface CostCards {
  total: number;
  limitHits: number;
  avgPerDay: number;
}

interface StatsCostPayload {
  pageId: string;
  periodLabel: string;
  canGoBack: boolean;
  canGoForward: boolean;
  bars: BarData[];
  averageLine: number | null;
  cards: CostCards;
  currency?: string;
  currencySymbol?: string;
  statusBar: unknown;
  advisory?: string | null;
}

// --- Formatting (browser-side) ---

function formatCurrency(minorUnits: number, symbol: string): string {
  const major = (minorUnits / 100).toFixed(2);
  return `${symbol}${major}`;
}

// --- Card definitions ---

interface CardDef {
  label: string;
  key: string;
  format: (cards: CostCards, symbol: string) => string;
}

function buildCardDefs(symbol: string): CardDef[] {
  return [
    { label: 'TOTAL', key: 'TOTAL', format: (c, s) => formatCurrency(c.total, s) },
    { label: `AVG ${symbol}/DAY`, key: 'AVG/DAY', format: (c, s) => formatCurrency(c.avgPerDay, s) },
    { label: 'LIMIT HITS', key: 'LIMIT HITS', format: (c) => c.limitHits.toString() },
  ];
}

// --- Module-level state ---

let selectedCard = 'TOTAL';
let currentData: StatsCostPayload | null = null;
let containerRef: HTMLElement | null = null;
let currencySymbol = '$'; // default, updated from payload

// --- Render ---

export function renderStatsCost(container: HTMLElement): void {
  containerRef = container;

  // Request data from extension
  sendToExtension({ type: 'requestPageData', payload: { pageId: 'stats.cost' } });

  container.innerHTML = `
    <div class="section-title">7-DAY EST. API-EQUIVALENT COST</div>
    <div class="cost-disclaimer">ESTIMATED API-EQUIVALENT COST. Subscription users are not charged per token. This shows what your usage would cost on the pay-as-you-go API.</div>
    <div id="chart-stats-cost" class="chart-area"><span class="learning-state">LOADING...</span></div>
    <div class="cards" id="cards-stats-cost"></div>
    <div class="page-body">
      <div class="mascot" id="mascot-stats-cost"></div>
    </div>
    <div class="advisory"></div>
  `;

  // Render cards in learning state
  renderCards();

  // Render mascot with default description
  const mascotEl = container.querySelector('#mascot-stats-cost') as HTMLElement;
  if (mascotEl) {
    renderMascot(mascotEl, 'stats', COST_CARD_DESCRIPTIONS[selectedCard] ?? '');
  }

  // If we already have data (re-render), apply it
  if (currentData) {
    applyData();
  }
}

// --- Update from extension ---

export function updateStatsCost(payload: unknown): void {
  currentData = payload as StatsCostPayload;
  if (currentData.currencySymbol) {
    currencySymbol = currentData.currencySymbol;
  }
  applyData();
  if (containerRef) renderAdvisory(containerRef, currentData.advisory);
}

function applyData(): void {
  if (!currentData || !containerRef) return;

  // Render chart
  const chartEl = containerRef.querySelector('#chart-stats-cost') as HTMLElement;
  if (chartEl) {
    renderBarChart(chartEl, {
      bars: currentData.bars,
      averageLine: currentData.averageLine,
      yAxisLabel: currencySymbol,
      isCostChart: true,
      currencySymbol: currencySymbol,
    });
  }

  // Update card values
  renderCards();
}

function renderCards(): void {
  if (!containerRef) return;
  const cardsEl = containerRef.querySelector('#cards-stats-cost') as HTMLElement;
  if (!cardsEl) return;

  cardsEl.innerHTML = '';

  const defs = buildCardDefs(currencySymbol);

  for (const def of defs) {
    const card = document.createElement('div');
    card.className = `card${def.key === selectedCard ? ' active' : ''}`;
    card.dataset.card = def.key;

    const valueText = currentData ? def.format(currentData.cards, currencySymbol) : '--';
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
  const cards = containerRef.querySelectorAll('#cards-stats-cost .card');
  for (const card of cards) {
    const htmlCard = card as HTMLElement;
    if (htmlCard.dataset.card === key) {
      htmlCard.classList.add('active');
    } else {
      htmlCard.classList.remove('active');
    }
  }

  // Update mascot description
  const mascotEl = containerRef.querySelector('#mascot-stats-cost') as HTMLElement;
  if (mascotEl) {
    renderMascot(mascotEl, 'stats', COST_CARD_DESCRIPTIONS[key] ?? '');
  }
}
