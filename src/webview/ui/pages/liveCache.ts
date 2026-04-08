import { sendToExtension } from '../../messageBus';
import { renderMascot } from '../components/mascotPanel';
import { renderProjectSelector } from '../components/projectSelector';
import { renderAdvisory } from '../components/advisoryBox';
import { CACHE_STAT_DESCRIPTIONS } from '../config/statDescriptions';

// --- Interfaces (match the extension-side contract) ---

interface CacheStats {
  cacheState: 'FRESH' | 'EXPIRING' | 'EXPIRED' | 'UNKNOWN';
  idleTime: number;
  cacheSize: number;
  hitsToday: number;
  missesToday: number;
  savedToday: number;
}

interface SessionInfo {
  sessionId: string;
  projectName: string | null;
  lastActivity: string;
}

interface CachePagePayload {
  pageId: string;
  sessions: SessionInfo[];
  currentFilter: string | null;
  stats: CacheStats;
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

function formatDurationSeconds(totalSeconds: number): string {
  if (totalSeconds < 0) return '--';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  if (minutes > 0) return `${minutes}M ${seconds}S`;
  return `${seconds}S`;
}

// --- Stat row definitions ---

interface StatRow {
  label: string;
  format: (stats: CacheStats) => string;
  isAlarm?: (stats: CacheStats) => boolean;
}

const STAT_ROWS: StatRow[] = [
  {
    label: 'CACHE STATE',
    format: (s) => s.cacheState,
    isAlarm: (s) => s.cacheState === 'EXPIRED',
  },
  { label: 'IDLE TIME', format: (s) => formatDurationSeconds(s.idleTime) },
  { label: 'CACHE SIZE', format: (s) => formatWithCommas(s.cacheSize) },
  { label: 'HITS TODAY', format: (s) => formatWithCommas(s.hitsToday) },
  { label: 'MISSES TODAY', format: (s) => formatWithCommas(s.missesToday) },
  { label: 'SAVED TODAY', format: (s) => formatCompact(s.savedToday) },
];

// --- Module-level state ---

let selectedStat = 'CACHE STATE';
let currentData: CachePagePayload | null = null;
let containerRef: HTMLElement | null = null;

// --- Cache lifetime bar ---

function renderCacheBar(container: HTMLElement, idleTime: number): void {
  let bar = container.querySelector('.cache-bar') as HTMLElement | null;
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'cache-bar';
    // Insert after project selector, before stat rows
    const statlist = container.querySelector('#cache-statlist') as HTMLElement;
    if (statlist) {
      // Insert as second child (after project selector if present, or first)
      const firstStat = statlist.querySelector('.stat');
      if (firstStat) {
        statlist.insertBefore(bar, firstStat);
      } else {
        statlist.appendChild(bar);
      }
    }
  }

  const totalSegments = 10;
  const secondsPerSegment = 30;
  const maxTime = totalSegments * secondsPerSegment; // 300 seconds = 5 minutes
  const filledCount = idleTime >= maxTime
    ? 0
    : Math.ceil((maxTime - idleTime) / secondsPerSegment);

  bar.innerHTML = '';
  for (let i = 0; i < totalSegments; i++) {
    const seg = document.createElement('div');
    if (i < filledCount) {
      // Last filled segment gets warning style
      if (i === filledCount - 1 && filledCount < totalSegments) {
        seg.className = 'cache-bar-segment warning';
      } else {
        seg.className = 'cache-bar-segment';
      }
    } else {
      seg.className = 'cache-bar-segment empty';
    }
    bar.appendChild(seg);
  }
}

// --- Render ---

export function renderLiveCache(container: HTMLElement): void {
  containerRef = container;

  // Request data from extension
  sendToExtension({ type: 'requestPageData', payload: { pageId: 'live.cache' } });

  container.innerHTML = `
    <div class="page-body">
      <div class="statlist" id="cache-statlist"></div>
      <div class="mascot" id="mascot-cache"></div>
    </div>
    <div class="advisory"></div>
  `;

  const statlist = container.querySelector('#cache-statlist') as HTMLElement;

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

  // Set initial learning state for CACHE STATE
  const cacheStateEl = statlist.querySelector('[data-stat="CACHE STATE"] .stat-value') as HTMLElement | null;
  if (cacheStateEl) cacheStateEl.textContent = 'UNKNOWN';

  // Render mascot with default description
  const mascotEl = container.querySelector('#mascot-cache') as HTMLElement;
  if (mascotEl) {
    renderMascot(mascotEl, 'live', CACHE_STAT_DESCRIPTIONS[selectedStat] ?? '');
  }

  // If we already have data (re-render), apply it
  if (currentData) {
    updateStats();
    updateProjectSelector();
  }
}

// --- Update from extension ---

export function updateLiveCache(payload: unknown): void {
  currentData = payload as CachePagePayload;
  updateStats();
  updateProjectSelector();
  if (containerRef) renderAdvisory(containerRef, currentData.advisory);
}

function updateStats(): void {
  if (!currentData || !containerRef) return;
  const stats = currentData.stats;
  const statlist = containerRef.querySelector('#cache-statlist');
  if (!statlist) return;

  for (const row of STAT_ROWS) {
    const el = statlist.querySelector(`[data-stat="${row.label}"] .stat-value`) as HTMLElement | null;
    if (el) {
      el.textContent = row.format(stats);
      el.classList.remove('learning-state');
    }

    // Apply alarm class for EXPIRED state
    const statEl = statlist.querySelector(`[data-stat="${row.label}"]`) as HTMLElement | null;
    if (statEl && row.isAlarm) {
      if (row.isAlarm(stats)) {
        statEl.classList.add('alarm');
      } else {
        statEl.classList.remove('alarm');
      }
    }
  }

  // Update cache lifetime bar
  renderCacheBar(containerRef, stats.idleTime);
}

function updateProjectSelector(): void {
  if (!currentData || !containerRef) return;
  const statlist = containerRef.querySelector('#cache-statlist') as HTMLElement;
  if (!statlist) return;

  renderProjectSelector(statlist, {
    sessions: currentData.sessions,
    currentFilter: currentData.currentFilter,
    allowAll: false,
    pageId: 'live.cache',
  });
}

function selectStat(label: string): void {
  selectedStat = label;

  if (!containerRef) return;
  const statlist = containerRef.querySelector('#cache-statlist');
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
  const mascotEl = containerRef.querySelector('#mascot-cache') as HTMLElement;
  if (mascotEl) {
    renderMascot(mascotEl, 'live', CACHE_STAT_DESCRIPTIONS[label] ?? '');
  }
}
