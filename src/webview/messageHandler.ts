/**
 * Extension-side message handler.
 * Receives messages from the webview, queries repositories,
 * calls domain functions, and returns computed payloads.
 */

import { getActiveSessions, getAllSessions } from '../data/repositories/sessionRepo';
import { getCurrentWindow } from '../data/repositories/windowRepo';
import {
  getRecentTurns,
  getLastTurnForSession,
  getLastTurn,
  getSessionTurns,
  getTurnsForSessionToday,
  getTurnsBetween,
  getTurnCount,
} from '../data/repositories/turnRepo';
import {
  getMedianLimitHitTokens,
  getLimitHitsBetween,
  insertLimitHit,
} from '../data/repositories/limitHitRepo';
import { getSetting, setSetting, getAllSettings } from '../data/repositories/settingsRepo';
import { insertSync, getMostRecentSync } from '../data/repositories/syncRepo';
import { resetAllData } from '../data/db';
import { isPeak } from '../domain/peakHourSchedule';
import {
  computeSessionStats,
  computeSessionStatsFiltered,
  computeContextStats,
  computeCacheStats,
  computeStatusBar,
  toActiveSessionInfoList,
} from '../domain/liveStats';
import type { ModelContextWindows } from '../domain/liveStats';
import {
  getDateRange,
  aggregateByDay,
  aggregateByWeek,
  aggregateByMonth,
  aggregateCostByDay,
} from '../domain/historyStats';
import { getDefaultCurrency, getCurrencySymbol } from '../domain/costCalculator';
import { evaluateAdvisory } from '../domain/advisoryEngine';
import type { AdvisoryContext } from '../domain/advisoryEngine';
import { ADVISORY_RULES } from '../domain/advisoryRules';
import { hoursAgo, todayStartUtc, nowUtc, formatDuration } from '../utils/dateUtils';
import pricingData from '../domain/pricing.json';
import { logger } from '../utils/logger';

// --- Cached last request for live updates ---

let lastPageId: string | null = null;
let lastProjectFilter: string | undefined = undefined;
let lastPeriodOffset = 0;

// --- Extract model context windows from pricing data ---

const modelContextWindows: ModelContextWindows =
  pricingData.models as unknown as ModelContextWindows;

// --- Message types ---

interface RequestPageDataPayload {
  pageId: string;
  projectFilter?: string;
  periodOffset?: number;
}

interface WebviewMessage {
  type: string;
  payload?: unknown;
}

// --- Helpers ---

function isRequestPageData(payload: unknown): payload is RequestPageDataPayload {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }
  const p = payload as Record<string, unknown>;
  return typeof p.pageId === 'string';
}

// --- Advisory helpers ---

/**
 * Compute the historical average burn rate (tokens/min) over the last 24 hours.
 * Returns null if fewer than 30 minutes of data.
 */
function computeHistoricalAvgBurnRate(): number | null {
  const turns24h = getRecentTurns(hoursAgo(24));
  if (turns24h.length < 2) return null;

  const earliest = new Date(turns24h[0].timestamp).getTime();
  const latest = new Date(turns24h[turns24h.length - 1].timestamp).getTime();
  const elapsedMinutes = (latest - earliest) / 60_000;

  if (elapsedMinutes < 30) return null;

  let totalTokens = 0;
  for (const t of turns24h) {
    totalTokens += t.input_tokens + t.output_tokens;
  }

  return Math.round(totalTokens / elapsedMinutes);
}

// --- M5 payload interfaces and validators ---

interface UpdateSettingsPayload {
  key: string;
  value: string;
}

interface DashboardSyncPayload {
  fivehourPct: number;
  weeklyPct: number;
}

function isUpdateSettingsPayload(payload: unknown): payload is UpdateSettingsPayload {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return typeof p.key === 'string' && typeof p.value === 'string';
}

function isDashboardSyncPayload(payload: unknown): payload is DashboardSyncPayload {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.fivehourPct === 'number' &&
    typeof p.weeklyPct === 'number' &&
    p.fivehourPct >= 0 && p.fivehourPct <= 100 &&
    p.weeklyPct >= 0 && p.weeklyPct <= 100
  );
}

function buildSessionPage(projectFilter: string | undefined): unknown {
  const window = getCurrentWindow();
  const activeSessions = getActiveSessions(hoursAgo(2));
  const sessionInfoList = toActiveSessionInfoList(activeSessions);
  const personalThreshold = getMedianLimitHitTokens();
  const recentTurns = getRecentTurns(hoursAgo(1));

  let stats;
  if (projectFilter) {
    // Filtered to a specific session
    const turns = getSessionTurns(projectFilter);
    const sessionRecentTurns = recentTurns.filter(t => t.session_id === projectFilter);
    stats = computeSessionStatsFiltered(turns, sessionRecentTurns, personalThreshold);
  } else {
    // All sessions
    stats = computeSessionStats(window, recentTurns, activeSessions, personalThreshold);
  }

  // Status bar is always account-wide — use the absolute last turn for context fill
  const lastTurnForBar = getLastTurn();
  const weeklyTurns = getRecentTurns(hoursAgo(168)); // 7 days
  const currency = getSetting('currency') ?? getDefaultCurrency();
  const statusBar = computeStatusBar(
    window,
    isPeak(new Date()),
    lastTurnForBar,
    modelContextWindows,
    weeklyTurns,
    currency,
  );

  // Advisory
  const historicalAvgBurnRate = computeHistoricalAvgBurnRate();
  const advisoryCtx: AdvisoryContext = {
    pageId: 'live.session',
    burnRate: stats.burnRate,
    historicalAvgBurnRate,
    sessionTimeSeconds: stats.sessionTime,
    projectFilter: projectFilter ?? null,
  };
  const advisory = evaluateAdvisory(ADVISORY_RULES, advisoryCtx);

  return {
    type: 'pageData',
    payload: {
      pageId: 'live.session',
      sessions: sessionInfoList,
      currentFilter: projectFilter ?? null,
      stats,
      statusBar,
      advisory,
    },
  };
}

function buildContextPage(projectFilter: string | undefined): unknown {
  const activeSessions = getActiveSessions(hoursAgo(2));
  const sessionInfoList = toActiveSessionInfoList(activeSessions);

  // Context page needs a specific session's last turn
  const targetSession = projectFilter ?? (activeSessions.length > 0 ? activeSessions[0].session_id : undefined);
  let lastTurn = targetSession ? getLastTurnForSession(targetSession) : undefined;
  // Fallback to absolute last turn if session-specific lookup fails
  if (!lastTurn) lastTurn = getLastTurn();

  const stats = computeContextStats(lastTurn, modelContextWindows);

  // Status bar
  const window = getCurrentWindow();
  const lastTurnForBar = getLastTurn();
  const weeklyTurns = getRecentTurns(hoursAgo(168));
  const currency = getSetting('currency') ?? getDefaultCurrency();
  const statusBar = computeStatusBar(
    window,
    isPeak(new Date()),
    lastTurnForBar,
    modelContextWindows,
    weeklyTurns,
    currency,
  );

  // Advisory
  const advisoryCtx: AdvisoryContext = {
    pageId: 'live.context',
    utilisation: stats.utilisation,
  };
  const advisory = evaluateAdvisory(ADVISORY_RULES, advisoryCtx);

  return {
    type: 'pageData',
    payload: {
      pageId: 'live.context',
      sessions: sessionInfoList,
      currentFilter: projectFilter ?? null,
      stats,
      statusBar,
      advisory,
    },
  };
}

function buildCachePage(projectFilter: string | undefined): unknown {
  const activeSessions = getActiveSessions(hoursAgo(2));
  const sessionInfoList = toActiveSessionInfoList(activeSessions);

  // Cache page needs a specific session
  const targetSession = projectFilter ?? (activeSessions.length > 0 ? activeSessions[0].session_id : undefined);
  const lastTurn = targetSession ? getLastTurnForSession(targetSession) : undefined;
  const todayTurns = targetSession ? getTurnsForSessionToday(targetSession, todayStartUtc()) : [];
  const nowMs = Date.now();

  const stats = computeCacheStats(lastTurn, todayTurns, nowMs);

  // Status bar
  const window = getCurrentWindow();
  const lastTurnForBar = getLastTurn();
  const weeklyTurns = getRecentTurns(hoursAgo(168));
  const currency = getSetting('currency') ?? getDefaultCurrency();
  const statusBar = computeStatusBar(
    window,
    isPeak(new Date()),
    lastTurnForBar,
    modelContextWindows,
    weeklyTurns,
    currency,
  );

  // Advisory
  const totalHitsAndMisses = stats.hitsToday + stats.missesToday;
  const hitRate = totalHitsAndMisses > 0 ? (stats.hitsToday / totalHitsAndMisses) * 100 : undefined;
  const advisoryCtx: AdvisoryContext = {
    pageId: 'live.cache',
    cacheState: stats.cacheState,
    hitRate,
    hitsToday: stats.hitsToday,
    missesToday: stats.missesToday,
    savedToday: stats.savedToday,
  };
  const advisory = evaluateAdvisory(ADVISORY_RULES, advisoryCtx);

  return {
    type: 'pageData',
    payload: {
      pageId: 'live.cache',
      sessions: sessionInfoList,
      currentFilter: projectFilter ?? null,
      stats,
      statusBar,
      advisory,
    },
  };
}

// --- Stats/history page builders ---

/** Shared status bar computation, reused across all pages. */
function buildStatusBar(): unknown {
  const window = getCurrentWindow();
  const lastTurnForBar = getLastTurn();
  const weeklyTurns = getRecentTurns(hoursAgo(168));
  const currency = getSetting('currency') ?? getDefaultCurrency();
  return computeStatusBar(
    window,
    isPeak(new Date()),
    lastTurnForBar,
    modelContextWindows,
    weeklyTurns,
    currency,
  );
}

const STATS_TOKEN_PAGES = new Set(['stats.tokens', 'history.week']);
const STATS_COST_PAGES = new Set(['stats.cost']);
const MONTHLY_PAGES = new Set(['history.month']);
const MONTH_PLUS_PAGES = new Set(['history.quarter', 'history.year']);

function buildStatsPage(pageId: string, periodOffset: number): unknown {
  const { start, end, label } = getDateRange(pageId, periodOffset);
  const turns = getTurnsBetween(start.toISOString(), end.toISOString());
  const limitHits = getLimitHitsBetween(start.toISOString(), end.toISOString());
  const canGoBack = true;
  const canGoForward = periodOffset < 0;
  const isPastPeriod = periodOffset < 0;
  const statusBar = buildStatusBar();

  if (STATS_COST_PAGES.has(pageId)) {
    const currency = getSetting('currency') ?? getDefaultCurrency();
    const result = aggregateCostByDay(turns, limitHits, start, end, currency);
    return {
      type: 'pageData',
      payload: {
        pageId,
        periodLabel: label,
        canGoBack,
        canGoForward,
        bars: result.bars,
        averageLine: result.averageLine,
        cards: result.cards,
        currency,
        currencySymbol: getCurrencySymbol(currency),
        statusBar,
        advisory: null, // stats.cost has no advisory rules yet
      },
    };
  }

  if (STATS_TOKEN_PAGES.has(pageId)) {
    const result = aggregateByDay(turns, limitHits, start, end);

    // Advisory for stats.tokens and history.week
    const advisoryCtx: AdvisoryContext = {
      pageId,
      peakPercent: result.cards.peakPct,
      limitHitCount: result.cards.limitHits,
      periodLabel: label,
      isPastPeriod,
    };
    const advisory = evaluateAdvisory(ADVISORY_RULES, advisoryCtx);

    return {
      type: 'pageData',
      payload: {
        pageId,
        periodLabel: label,
        canGoBack,
        canGoForward,
        bars: result.bars,
        averageLine: result.averageLine,
        cards: result.cards,
        statusBar,
        advisory,
      },
    };
  }

  if (MONTHLY_PAGES.has(pageId)) {
    const result = aggregateByWeek(turns, limitHits, start, end);

    // Compute heaviest week info for advisory
    const overallDailyAvg = result.cards.avgPerDay;
    let heaviestWeekLabel: string | undefined;
    let heaviestWeekMultiplier: number | undefined;
    if (overallDailyAvg > 0) {
      for (const bar of result.bars) {
        const barDailyAvg = bar.peakValue + bar.offpeakValue; // already daily avg from aggregateByWeek
        const multiplier = barDailyAvg / overallDailyAvg;
        if (heaviestWeekMultiplier === undefined || multiplier > heaviestWeekMultiplier) {
          heaviestWeekMultiplier = multiplier;
          heaviestWeekLabel = bar.label;
        }
      }
    }

    const advisoryCtx: AdvisoryContext = {
      pageId: 'history.month',
      peakPercent: result.cards.peakPct,
      limitHitCount: result.cards.limitHits,
      periodLabel: label,
      isPastPeriod,
      heaviestWeekLabel,
      heaviestWeekMultiplier,
    };
    const advisory = evaluateAdvisory(ADVISORY_RULES, advisoryCtx);

    return {
      type: 'pageData',
      payload: {
        pageId,
        periodLabel: label,
        canGoBack,
        canGoForward,
        bars: result.bars,
        averageLine: result.averageLine,
        cards: result.cards,
        statusBar,
        advisory,
      },
    };
  }

  if (MONTH_PLUS_PAGES.has(pageId)) {
    const result = aggregateByMonth(turns, limitHits, start, end);

    // Advisory for quarter/year — only past-period rule
    const advisoryCtx: AdvisoryContext = {
      pageId,
      peakPercent: result.cards.peakPct,
      limitHitCount: result.cards.limitHits,
      periodLabel: label,
      isPastPeriod,
    };
    const advisory = evaluateAdvisory(ADVISORY_RULES, advisoryCtx);

    return {
      type: 'pageData',
      payload: {
        pageId,
        periodLabel: label,
        canGoBack,
        canGoForward,
        bars: result.bars,
        averageLine: result.averageLine,
        cards: result.cards,
        statusBar,
        advisory,
      },
    };
  }

  // Should not reach here — fallback
  return null;
}

/** Handle a manual limit hit report from the webview. */
function handleManualLimitHit(): unknown | null {
  try {
    const window = getCurrentWindow();
    insertLimitHit({
      timestamp: new Date().toISOString(),
      window_id: window ? window.window_id : null,
      detection_method: 'manual',
      peak_input_tokens: window?.peak_input_tokens ?? 0,
      peak_output_tokens: window?.peak_output_tokens ?? 0,
      offpeak_input_tokens: window?.offpeak_input_tokens ?? 0,
      offpeak_output_tokens: window?.offpeak_output_tokens ?? 0,
      notes: null,
    });

    // Return refreshed data for the last-viewed page
    if (lastPageId && isStatsOrHistoryPage(lastPageId)) {
      return buildStatsPage(lastPageId, lastPeriodOffset);
    }
    return null;
  } catch (err) {
    logger.error('Error handling manual limit hit', err);
    return null;
  }
}

const STATS_HISTORY_PAGE_IDS = new Set([
  'stats.tokens', 'stats.cost',
  'history.week', 'history.month', 'history.quarter', 'history.year',
]);

function isStatsOrHistoryPage(pageId: string): boolean {
  return STATS_HISTORY_PAGE_IDS.has(pageId);
}

// --- M5 handlers ---

/** Compute the sync age label from a timestamp string. */
function computeSyncAgeLabel(syncTimestamp: string | undefined): string {
  if (!syncTimestamp) return 'never';
  const ageMs = Date.now() - new Date(syncTimestamp).getTime();
  if (ageMs < 0) return 'just now';
  return `${formatDuration(ageMs)} ago`;
}

/** Sum all token counters on the current window for dashboard sync snapshot. */
function getWindowTotalTokens(): number {
  const window = getCurrentWindow();
  if (!window) return 0;
  return (
    window.peak_input_tokens +
    window.peak_output_tokens +
    window.offpeak_input_tokens +
    window.offpeak_output_tokens +
    window.peak_cache_creation_tokens +
    window.peak_cache_read_tokens +
    window.offpeak_cache_creation_tokens +
    window.offpeak_cache_read_tokens
  );
}

function handleUpdateSettings(payload: unknown): unknown | null {
  if (!isUpdateSettingsPayload(payload)) {
    logger.warn('Invalid updateSettings payload');
    return null;
  }
  try {
    setSetting(payload.key, payload.value);
    return { type: 'settingsChanged', payload: { settings: getAllSettings() } };
  } catch (err) {
    logger.error('Error updating setting', err);
    return null;
  }
}

function handleDashboardSync(payload: unknown): unknown | null {
  if (!isDashboardSyncPayload(payload)) {
    logger.warn('Invalid dashboardSync payload');
    return null;
  }
  try {
    const codeTokens = getWindowTotalTokens();
    const planTier = getSetting('plan_tier') ?? null;
    const fivehourPct = payload.fivehourPct;

    // Infer total usage from dashboard percentage and tracked code tokens.
    // If dashboard says N% used, total estimated = codeTokens / (fivehourPct/100).
    // Other = total - codeTokens. Clamp to 0.
    const dashFraction = Math.max(fivehourPct / 100, 0.01);
    const totalEstimated = Math.round(codeTokens / dashFraction);
    const inferredOther = Math.max(0, totalEstimated - codeTokens);

    insertSync({
      timestamp: nowUtc(),
      fivehour_pct: fivehourPct,
      weekly_pct: payload.weeklyPct,
      code_tokens_at_sync: codeTokens,
      inferred_other: inferredOther,
      plan_tier_at_sync: planTier,
    });

    // Return refreshed about.info data so the page updates
    return buildAboutInfoPage();
  } catch (err) {
    logger.error('Error handling dashboard sync', err);
    return null;
  }
}

function handleCompleteOnboarding(): unknown | null {
  try {
    setSetting('onboarding_completed_at', nowUtc());
    return { type: 'settingsChanged', payload: { settings: getAllSettings() } };
  } catch (err) {
    logger.error('Error completing onboarding', err);
    return null;
  }
}

function handleResetHistory(): unknown | null {
  try {
    resetAllData();
    return { type: 'settingsChanged', payload: { settings: getAllSettings() } };
  } catch (err) {
    logger.error('Error resetting history', err);
    return null;
  }
}

// Callback for triggering a full JSONL rescan — set by extension.ts
let resyncCallback: (() => void) | null = null;

export function setResyncHandler(fn: () => void): void {
  resyncCallback = fn;
}

function handleResyncData(): unknown | null {
  try {
    resetAllData();
    resyncCallback?.();
    return buildAboutInfoPage();
  } catch (err) {
    logger.error('Error resyncing data', err);
    return null;
  }
}

/** Build the about.info page payload. */
function buildAboutInfoPage(): unknown {
  const settings = getAllSettings();

  // Auto-detect timezone and currency if not already stored
  let timezone = settings['timezone'];
  if (!timezone) {
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      timezone = 'UTC';
    }
  }

  let currency = settings['currency'];
  if (!currency) {
    currency = getDefaultCurrency();
  }

  const sessionsTracked = getAllSessions().length;
  const turnsTracked = getTurnCount();
  const recentSync = getMostRecentSync();
  const lastSyncTimestamp = recentSync?.timestamp ?? undefined;
  const syncAgeLabel = computeSyncAgeLabel(lastSyncTimestamp);

  const statusBar = buildStatusBar();

  return {
    type: 'pageData',
    payload: {
      pageId: 'about.info',
      settings: {
        plan_tier: settings['plan_tier'] ?? 'pro',
        currency,
        timezone,
        blip_sound: settings['blip_sound'] ?? 'on',
        crt_flicker: settings['crt_flicker'] ?? 'on',
      },
      info: {
        version: __APP_VERSION__,
        dbConnected: true,
        sessionsTracked,
        turnsTracked,
        lastSync: lastSyncTimestamp ?? null,
        syncAgeLabel,
      },
      statusBar,
    },
  };
}

/** Build a static content page payload (tips, about.glossary). */
function buildStaticPage(pageId: string): unknown {
  const statusBar = buildStatusBar();
  return {
    type: 'pageData',
    payload: {
      pageId,
      statusBar,
    },
  };
}

// --- Public API ---

/**
 * Handle an incoming message from the webview.
 * Returns the response payload, or null if the message is not handled.
 */
export function handleWebviewMessage(message: WebviewMessage): unknown | null {
  try {
    if (message.type === 'manualLimitHit') {
      return handleManualLimitHit();
    }

    if (message.type === 'updateSettings') {
      return handleUpdateSettings(message.payload);
    }

    if (message.type === 'dashboardSync') {
      return handleDashboardSync(message.payload);
    }

    if (message.type === 'completeOnboarding') {
      return handleCompleteOnboarding();
    }

    if (message.type === 'resetHistory') {
      return handleResetHistory();
    }

    if (message.type === 'resyncData') {
      return handleResyncData();
    }

    if (message.type !== 'requestPageData') {
      return null;
    }

    if (!isRequestPageData(message.payload)) {
      logger.warn('Invalid requestPageData payload');
      return null;
    }

    const { pageId, projectFilter } = message.payload;
    const periodOffset = message.payload.periodOffset ?? 0;

    // Cache for live updates
    lastPageId = pageId;
    lastProjectFilter = projectFilter;
    lastPeriodOffset = periodOffset;

    switch (pageId) {
      case 'live.session':
        return buildSessionPage(projectFilter);
      case 'live.context':
        return buildContextPage(projectFilter);
      case 'live.cache':
        return buildCachePage(projectFilter);
      case 'stats.tokens':
      case 'stats.cost':
      case 'history.week':
      case 'history.month':
      case 'history.quarter':
      case 'history.year':
        return buildStatsPage(pageId, periodOffset);
      case 'about.info':
        return buildAboutInfoPage();
      case 'tips.cache':
      case 'tips.peak-hours':
      case 'tips.context':
      case 'tips.other':
      case 'about.glossary':
        return buildStaticPage(pageId);
      default:
        logger.warn(`Unknown pageId: ${pageId}`);
        return null;
    }
  } catch (err) {
    logger.error('Error handling webview message', err);
    return null;
  }
}

/**
 * Re-compute the last requested page using cached (pageId, projectFilter, periodOffset).
 * Called by the watcher callback when new JSONL data arrives.
 */
export function computeLiveUpdate(): unknown | null {
  try {
    if (!lastPageId) {
      return null;
    }

    switch (lastPageId) {
      case 'live.session':
        return buildSessionPage(lastProjectFilter);
      case 'live.context':
        return buildContextPage(lastProjectFilter);
      case 'live.cache':
        return buildCachePage(lastProjectFilter);
      case 'stats.tokens':
      case 'stats.cost':
      case 'history.week':
      case 'history.month':
      case 'history.quarter':
      case 'history.year':
        return buildStatsPage(lastPageId, lastPeriodOffset);
      default:
        return null;
    }
  } catch (err) {
    logger.error('Error computing live update', err);
    return null;
  }
}
