import { sendToExtension } from '../../messageBus';
import { renderMascot } from '../components/mascotPanel';
import { renderProjectSelector } from '../components/projectSelector';
import { renderAdvisory } from '../components/advisoryBox';
import { CONTEXT_STAT_DESCRIPTIONS } from '../config/statDescriptions';

// --- Interfaces (match the extension-side contract) ---

interface ContextStats {
  estContextUsed: number;
  contextMax: number;
  utilisation: number;
  model: string | null;
}

interface SessionInfo {
  sessionId: string;
  projectName: string | null;
  lastActivity: string;
}

interface ContextPagePayload {
  pageId: string;
  sessions: SessionInfo[];
  currentFilter: string | null;
  stats: ContextStats;
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

// --- Stat row definitions ---

interface StatRow {
  label: string;
  format: (stats: ContextStats) => string;
}

const STAT_ROWS: StatRow[] = [
  { label: 'EST. CONTEXT USED', format: (s) => formatWithCommas(s.estContextUsed) },
  { label: 'CONTEXT MAX', format: (s) => formatCompact(s.contextMax) },
  { label: 'UTILISATION', format: (s) => `${s.utilisation.toFixed(0)}%` },
];

// --- Module-level state ---

let selectedStat = 'EST. CONTEXT USED';
let currentData: ContextPagePayload | null = null;
let containerRef: HTMLElement | null = null;

// --- Render ---

export function renderLiveContext(container: HTMLElement): void {
  containerRef = container;

  // Request data from extension
  sendToExtension({ type: 'requestPageData', payload: { pageId: 'live.context' } });

  container.innerHTML = `
    <div class="page-body">
      <div class="statlist" id="context-statlist">
        <div class="fillbar-label">
          <span>CONTEXT USED</span>
          <span id="context-fillbar-value" class="learning-state">--</span>
        </div>
        <div class="fillbar" id="context-fillbar">
          <div class="fillbar-segment" id="context-fill-segment" style="width: 0%; background: var(--green-bright);"></div>
        </div>
        <div style="height: 12px;"></div>
      </div>
      <div class="mascot" id="mascot-context"></div>
    </div>
    <div class="advisory"></div>
  `;

  const statlist = container.querySelector('#context-statlist') as HTMLElement;

  // Render stat rows
  for (const row of STAT_ROWS) {
    const div = document.createElement('div');
    div.className = `stat${row.label === selectedStat ? ' active' : ''}`;
    div.dataset.stat = row.label;
    div.innerHTML = `<span>${row.label}</span><span class="stat-value learning-state">--</span>`;

    div.addEventListener('click', () => {
      selectStat(row.label);
    });

    statlist.appendChild(div);
  }

  // Render mascot with default description
  const mascotEl = container.querySelector('#mascot-context') as HTMLElement;
  if (mascotEl) {
    renderMascot(mascotEl, 'live', CONTEXT_STAT_DESCRIPTIONS[selectedStat] ?? '');
  }

  // If we already have data (re-render), apply it
  if (currentData) {
    updateStats();
    updateProjectSelector();
  }
}

// --- Update from extension ---

export function updateLiveContext(payload: unknown): void {
  currentData = payload as ContextPagePayload;

  if (currentData.sessions.length === 0) {
    showNoDataState();
    return;
  }

  updateStats();
  updateProjectSelector();
  if (containerRef) renderAdvisory(containerRef, currentData.advisory);
}

function showNoDataState(): void {
  if (!containerRef) return;
  const statlist = containerRef.querySelector('#context-statlist');
  if (!statlist) return;

  // Clear stat rows and show message
  const pageBody = containerRef.querySelector('.page-body');
  if (pageBody) {
    pageBody.innerHTML = `
      <div class="no-data-message">
        No active sessions. Open a Claude Code session to see context fill.
      </div>
    `;
  }
}

function updateStats(): void {
  if (!currentData || !containerRef) return;
  const stats = currentData.stats;

  // Update fill bar
  const fillSegment = containerRef.querySelector('#context-fill-segment') as HTMLElement | null;
  if (fillSegment) {
    fillSegment.style.width = `${stats.utilisation}%`;
    fillSegment.style.background = stats.utilisation > 80
      ? 'var(--alarm-red)'
      : 'var(--green-bright)';
  }

  // Update fill bar label
  const fillValue = containerRef.querySelector('#context-fillbar-value') as HTMLElement | null;
  if (fillValue) {
    fillValue.textContent = `${stats.utilisation.toFixed(0)}%`;
    fillValue.classList.remove('learning-state');
  }

  // Update stat rows
  const statlist = containerRef.querySelector('#context-statlist');
  if (!statlist) return;

  for (const row of STAT_ROWS) {
    const el = statlist.querySelector(`[data-stat="${row.label}"] .stat-value`) as HTMLElement | null;
    if (el) {
      el.textContent = row.format(stats);
      el.classList.remove('learning-state');
    }
  }
}

function updateProjectSelector(): void {
  if (!currentData || !containerRef) return;
  const statlist = containerRef.querySelector('#context-statlist') as HTMLElement;
  if (!statlist) return;

  renderProjectSelector(statlist, {
    sessions: currentData.sessions,
    currentFilter: currentData.currentFilter,
    allowAll: false,
    pageId: 'live.context',
  });
}

function selectStat(label: string): void {
  selectedStat = label;

  if (!containerRef) return;
  const statlist = containerRef.querySelector('#context-statlist');
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
  const mascotEl = containerRef.querySelector('#mascot-context') as HTMLElement;
  if (mascotEl) {
    renderMascot(mascotEl, 'live', CONTEXT_STAT_DESCRIPTIONS[label] ?? '');
  }
}
