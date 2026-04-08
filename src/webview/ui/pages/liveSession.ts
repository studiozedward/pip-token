import { sendToExtension } from '../../messageBus';
import { renderMascot } from '../components/mascotPanel';
import { renderProjectSelector } from '../components/projectSelector';
import { renderAdvisory } from '../components/advisoryBox';
import { SESSION_STAT_DESCRIPTIONS } from '../config/statDescriptions';

// --- Interfaces (match the extension-side contract) ---

interface SessionStats {
  inputTokens: number;
  outputTokens: number;
  peakTokens: number;
  offpeakTokens: number;
  burnRate: number | 'LEARNING' | 'STALE';
  estTimeToLimit: number | null;
  sessionTime: number;
}

interface SessionInfo {
  sessionId: string;
  projectName: string | null;
  lastActivity: string;
}

interface SessionPagePayload {
  pageId: string;
  sessions: SessionInfo[];
  currentFilter: string | null;
  stats: SessionStats;
  statusBar: unknown;
  advisory?: string | null;
}

// --- Formatting (browser-side reimplementations) ---

function formatWithCommas(n: number): string {
  return n.toLocaleString('en-US');
}

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

function formatDuration(ms: number): string {
  if (ms < 0) return '--';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}H ${minutes}M`;
  return `${minutes}M`;
}

// --- Stat row definitions ---

interface StatRow {
  label: string;
  format: (stats: SessionStats) => string;
}

const STAT_ROWS: StatRow[] = [
  { label: 'INPUT TOKENS', format: (s) => formatWithCommas(s.inputTokens) },
  { label: 'OUTPUT TOKENS', format: (s) => formatWithCommas(s.outputTokens) },
  { label: 'PEAK TOKENS', format: (s) => formatWithCommas(s.peakTokens) },
  { label: 'OFF-PEAK TOKENS', format: (s) => formatWithCommas(s.offpeakTokens) },
  {
    label: 'BURN RATE',
    format: (s) => typeof s.burnRate === 'number' ? formatBurnRate(s.burnRate) : s.burnRate,
  },
  {
    label: 'TIME TO LIMIT',
    format: (s) => {
      if (s.estTimeToLimit !== null) return `~${formatDuration(s.estTimeToLimit * 60000)}`;
      if (typeof s.burnRate === 'string') return s.burnRate;
      return 'LEARNING';
    },
  },
  { label: 'SESSION TIME', format: (s) => formatDuration(s.sessionTime * 1000) },
];

// --- Module-level state ---

const DEFAULT_MASCOT_TEXT = 'Click a metric to learn more about it.';
let selectedStat: string | null = null;
let currentData: SessionPagePayload | null = null;
let containerRef: HTMLElement | null = null;

// --- Render ---

export function renderLiveSession(container: HTMLElement): void {
  containerRef = container;

  // Request data from extension
  sendToExtension({ type: 'requestPageData', payload: { pageId: 'live.session' } });

  container.innerHTML = `
    <div class="page-body">
      <div class="statlist" id="session-statlist"></div>
      <div class="mascot" id="mascot-live"></div>
    </div>
    <div class="advisory"></div>
  `;

  const statlist = container.querySelector('#session-statlist') as HTMLElement;

  // Render stat rows
  for (const row of STAT_ROWS) {
    const div = document.createElement('div');
    div.className = `stat${row.label === selectedStat ? ' active' : ''}`;
    div.dataset.stat = row.label;
    div.innerHTML = `<span>${row.label}</span><span class="stat-value learning-state">--</span>`;

    div.addEventListener('click', (e) => {
      e.stopPropagation();
      selectStat(row.label);
    });

    statlist.appendChild(div);
  }

  // Click outside stat rows deselects and restores default owl
  container.addEventListener('click', () => {
    deselectStat();
  });

  // Set initial learning states for special rows
  const burnEl = statlist.querySelector('[data-stat="BURN RATE"] .stat-value') as HTMLElement | null;
  if (burnEl) burnEl.textContent = 'LEARNING';
  const ttlEl = statlist.querySelector('[data-stat="TIME TO LIMIT"] .stat-value') as HTMLElement | null;
  if (ttlEl) ttlEl.textContent = 'LEARNING';

  // Render mascot with default description
  const mascotEl = container.querySelector('#mascot-live') as HTMLElement;
  if (mascotEl) {
    const desc = selectedStat ? (SESSION_STAT_DESCRIPTIONS[selectedStat] ?? '') : DEFAULT_MASCOT_TEXT;
    renderMascot(mascotEl, 'live', desc);
  }

  // If we already have data (re-render), apply it
  if (currentData) {
    updateStats();
    updateProjectSelector();
  }
}

// --- Update from extension ---

export function updateLiveSession(payload: unknown): void {
  currentData = payload as SessionPagePayload;
  updateStats();
  updateProjectSelector();
  if (containerRef) renderAdvisory(containerRef, currentData.advisory);
}

function updateStats(): void {
  if (!currentData || !containerRef) return;
  const stats = currentData.stats;
  const statlist = containerRef.querySelector('#session-statlist');
  if (!statlist) return;

  const isAllProjects = currentData.currentFilter === null;

  for (const row of STAT_ROWS) {
    const rowEl = statlist.querySelector(`[data-stat="${row.label}"]`) as HTMLElement | null;
    if (!rowEl) continue;

    // Hide SESSION TIME in ALL PROJECTS view — it's not meaningful for aggregates
    if (row.label === 'SESSION TIME' && isAllProjects) {
      rowEl.style.display = 'none';
      continue;
    } else if (row.label === 'SESSION TIME') {
      rowEl.style.display = '';
    }

    const el = rowEl.querySelector('.stat-value') as HTMLElement | null;
    if (el) {
      const formatted = row.format(stats);
      el.textContent = formatted;
      // Apply learning-state class for non-numeric placeholder states
      const isPlaceholder =
        (row.label === 'BURN RATE' && typeof stats.burnRate === 'string')
        || (row.label === 'TIME TO LIMIT' && stats.estTimeToLimit === null);
      if (isPlaceholder) {
        el.classList.add('learning-state');
      } else {
        el.classList.remove('learning-state');
      }
    }
  }
}

function updateProjectSelector(): void {
  if (!currentData || !containerRef) return;
  const statlist = containerRef.querySelector('#session-statlist') as HTMLElement;
  if (!statlist) return;

  renderProjectSelector(statlist, {
    sessions: currentData.sessions,
    currentFilter: currentData.currentFilter,
    allowAll: true,
    pageId: 'live.session',
  });
}

function selectStat(label: string): void {
  selectedStat = label;

  if (!containerRef) return;
  const statlist = containerRef.querySelector('#session-statlist');
  if (!statlist) return;

  // Toggle active class
  const rows = statlist.querySelectorAll('.stat');
  for (const row of rows) {
    const htmlRow = row as HTMLElement;
    if (htmlRow.dataset.stat === label) {
      htmlRow.classList.add('active');
    } else {
      htmlRow.classList.remove('active');
    }
  }

  // Update mascot description
  const mascotEl = containerRef.querySelector('#mascot-live') as HTMLElement;
  if (mascotEl) {
    renderMascot(mascotEl, 'live', SESSION_STAT_DESCRIPTIONS[label] ?? '');
  }
}

function deselectStat(): void {
  selectedStat = null;

  if (!containerRef) return;
  const statlist = containerRef.querySelector('#session-statlist');
  if (!statlist) return;

  // Remove active class from all rows
  const rows = statlist.querySelectorAll('.stat');
  for (const row of rows) {
    (row as HTMLElement).classList.remove('active');
  }

  // Restore default mascot text
  const mascotEl = containerRef.querySelector('#mascot-live') as HTMLElement;
  if (mascotEl) {
    renderMascot(mascotEl, 'live', DEFAULT_MASCOT_TEXT);
  }
}
