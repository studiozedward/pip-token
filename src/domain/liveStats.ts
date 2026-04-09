/**
 * Pure stat computation functions for the Live dashboard pages.
 * No database imports — all data is passed as parameters.
 */

import type { TurnRecord } from '../data/repositories/turnRepo';
import type { WindowRecord } from '../data/repositories/windowRepo';
import type { SessionRecord } from '../data/repositories/sessionRepo';
import { turnCostMinor } from './costCalculator';
import type { TurnCostInput } from './costCalculator';

// --- Interfaces ---

export type BurnRateState = number | 'LEARNING' | 'STALE';

export interface SessionPageStats {
  inputTokens: number;
  outputTokens: number;
  peakTokens: number;
  offpeakTokens: number;
  burnRate: BurnRateState;       // tokens/min, LEARNING = too few turns, STALE = timed out
  estTimeToLimit: number | null; // minutes, null = LEARNING (no limit hits)
  sessionTime: number;           // seconds
}

export interface ContextPageStats {
  estContextUsed: number;
  contextMax: number;
  utilisation: number;  // 0-100 percentage
  model: string | null;
}

export interface CachePageStats {
  cacheState: 'FRESH' | 'EXPIRING' | 'EXPIRED' | 'UNKNOWN';
  idleTime: number;      // seconds since last turn
  cacheSize: number;     // tokens in cache
  hitsToday: number;     // turns with cache_read > 0
  missesToday: number;   // turns with cache_creation > 0 and cache_read = 0
  savedToday: number;    // sum of cache_read tokens today
}

export interface StatusBarStats {
  isPeak: boolean;
  contextUsed: number;
  contextMax: number;
  burnRate: BurnRateState;
  weeklyTokens: number;
  weeklyCostMinor: number;
  currency: string;
}

export interface ActiveSessionInfo {
  sessionId: string;
  projectName: string | null;
  lastActivity: string;
  firstSeen: string;
}

// --- Type for model context windows extracted from pricing.json ---

interface ModelPricing {
  input_per_million: number;
  output_per_million: number;
  cache_write_per_million: number;
  cache_read_per_million: number;
  context_window: number;
}

export interface ModelContextWindows {
  [modelName: string]: ModelPricing;
}

// --- Internal helpers ---

const BURN_RATE_WINDOW_MS = 10 * 60 * 1000;
const CACHE_FRESH_THRESHOLD_S = 240;   // 4 minutes
const CACHE_EXPIRING_THRESHOLD_S = 300; // 5 minutes

function sumTokensFromTurns(turns: TurnRecord[]): { input: number; output: number; peak: number; offpeak: number } {
  let input = 0;
  let output = 0;
  let peak = 0;
  let offpeak = 0;

  for (const t of turns) {
    input += t.input_tokens;
    output += t.output_tokens;
    const turnTotal = t.input_tokens + t.output_tokens;
    if (t.is_peak) {
      peak += turnTotal;
    } else {
      offpeak += turnTotal;
    }
  }

  return { input, output, peak, offpeak };
}

function computeBurnRate(recentTurns: TurnRecord[], nowMs: number): BurnRateState {
  if (recentTurns.length < 2) {
    return 'LEARNING';
  }

  const windowStart = nowMs - BURN_RATE_WINDOW_MS;
  const turnsInWindow = recentTurns.filter(t => new Date(t.timestamp).getTime() >= windowStart);

  if (turnsInWindow.length < 2) {
    // Had turns historically but none recent enough
    return 'STALE';
  }

  const earliest = new Date(turnsInWindow[0].timestamp).getTime();
  const elapsedMs = nowMs - earliest;
  const elapsedMinutes = elapsedMs / 60_000;

  // Need at least 1 minute of spread to avoid wild spikes
  if (elapsedMinutes < 1) {
    return 'LEARNING';
  }

  let totalTokens = 0;
  for (const t of turnsInWindow) {
    totalTokens += t.input_tokens + t.output_tokens;
  }

  return Math.round(totalTokens / elapsedMinutes);
}

function computeEstTimeToLimit(
  currentWindowTotal: number,
  burnRate: BurnRateState,
  personalThreshold: { peakTokens: number; offpeakTokens: number } | null,
): number | null {
  if (personalThreshold === null || typeof burnRate !== 'number' || burnRate === 0) {
    return null;
  }

  // Use the larger threshold as a rough limit
  const threshold = Math.max(personalThreshold.peakTokens, personalThreshold.offpeakTokens);
  if (threshold <= 0) {
    return null;
  }

  const remaining = threshold - currentWindowTotal;
  if (remaining <= 0) {
    return 0;
  }

  return Math.round(remaining / burnRate);
}

function computeSessionTimeSeconds(activeSessions: SessionRecord[]): number {
  if (activeSessions.length === 0) {
    return 0;
  }

  // Find the earliest first_seen_at among active sessions
  let earliest = Infinity;
  for (const s of activeSessions) {
    const t = new Date(s.first_seen_at).getTime();
    if (t < earliest) {
      earliest = t;
    }
  }

  if (!isFinite(earliest)) {
    return 0;
  }

  return Math.max(0, Math.round((Date.now() - earliest) / 1000));
}

// --- Public functions ---

/**
 * Compute stats for the Session page when no project filter is applied (ALL sessions).
 * Sums from turn-level data across all active sessions so totals survive resync
 * and are not affected by rate-limit window boundaries.
 */
export function computeSessionStats(
  activeSessionTurns: TurnRecord[],
  recentTurns: TurnRecord[],
  activeSessions: SessionRecord[],
  personalThreshold: { peakTokens: number; offpeakTokens: number } | null,
): SessionPageStats {
  const sums = sumTokensFromTurns(activeSessionTurns);

  const nowMs = Date.now();
  const burnRate = computeBurnRate(recentTurns, nowMs);
  const currentTotal = sums.input + sums.output;
  const estTimeToLimit = computeEstTimeToLimit(currentTotal, burnRate, personalThreshold);
  const sessionTime = computeSessionTimeSeconds(activeSessions);

  return {
    inputTokens: sums.input,
    outputTokens: sums.output,
    peakTokens: sums.peak,
    offpeakTokens: sums.offpeak,
    burnRate,
    estTimeToLimit,
    sessionTime,
  };
}

/**
 * Compute stats for the Session page when filtered to a specific session.
 * Computes from turn-level data since window aggregates are account-wide.
 */
export function computeSessionStatsFiltered(
  turns: TurnRecord[],
  recentTurns: TurnRecord[],
  personalThreshold: { peakTokens: number; offpeakTokens: number } | null,
): SessionPageStats {
  const sums = sumTokensFromTurns(turns);

  const nowMs = Date.now();
  const burnRate = computeBurnRate(recentTurns, nowMs);
  const currentTotal = sums.input + sums.output;
  const estTimeToLimit = computeEstTimeToLimit(currentTotal, burnRate, personalThreshold);

  // Session time: from earliest turn to now
  let sessionTime = 0;
  if (turns.length > 0) {
    const earliest = new Date(turns[0].timestamp).getTime();
    sessionTime = Math.max(0, Math.round((nowMs - earliest) / 1000));
  }

  return {
    inputTokens: sums.input,
    outputTokens: sums.output,
    peakTokens: sums.peak,
    offpeakTokens: sums.offpeak,
    burnRate,
    estTimeToLimit,
    sessionTime,
  };
}

/**
 * Compute stats for the Context page.
 */
export function computeContextStats(
  lastTurn: TurnRecord | undefined,
  modelContextWindows: ModelContextWindows,
): ContextPageStats {
  if (!lastTurn) {
    return {
      estContextUsed: 0,
      contextMax: 200_000, // default fallback
      utilisation: 0,
      model: null,
    };
  }

  const model = lastTurn.model;
  const estContextUsed = lastTurn.input_tokens
    + lastTurn.cache_creation_input_tokens
    + lastTurn.cache_read_input_tokens;

  let contextMax = 200_000; // default
  if (model && model in modelContextWindows) {
    contextMax = modelContextWindows[model].context_window;
  }

  const utilisation = contextMax > 0
    ? Math.round((estContextUsed / contextMax) * 1000) / 10 // one decimal
    : 0;

  return {
    estContextUsed,
    contextMax,
    utilisation,
    model: model ?? null,
  };
}

/**
 * Compute stats for the Cache page.
 */
export function computeCacheStats(
  lastTurn: TurnRecord | undefined,
  todayTurns: TurnRecord[],
  nowMs: number,
): CachePageStats {
  if (!lastTurn) {
    return {
      cacheState: 'UNKNOWN',
      idleTime: 0,
      cacheSize: 0,
      hitsToday: 0,
      missesToday: 0,
      savedToday: 0,
    };
  }

  const lastTurnTime = new Date(lastTurn.timestamp).getTime();
  const idleTime = Math.max(0, Math.round((nowMs - lastTurnTime) / 1000));

  let cacheState: CachePageStats['cacheState'];
  if (idleTime < CACHE_FRESH_THRESHOLD_S) {
    cacheState = 'FRESH';
  } else if (idleTime < CACHE_EXPIRING_THRESHOLD_S) {
    cacheState = 'EXPIRING';
  } else {
    cacheState = 'EXPIRED';
  }

  const cacheSize = lastTurn.cache_read_input_tokens + lastTurn.cache_creation_input_tokens;

  let hitsToday = 0;
  let missesToday = 0;
  let savedToday = 0;

  for (const t of todayTurns) {
    if (t.cache_read_input_tokens > 0) {
      hitsToday++;
      // Cache reads cost ~10% of full input price (5-min TTL).
      // "Saved" = tokens not charged at full rate = 90% of cache reads.
      savedToday += Math.round(t.cache_read_input_tokens * 0.9);
    } else if (t.cache_creation_input_tokens > 0) {
      missesToday++;
    }
  }

  return {
    cacheState,
    idleTime,
    cacheSize,
    hitsToday,
    missesToday,
    savedToday,
  };
}

/** Turn a TurnRecord into the shape expected by turnCostMinor. */
function toTurnCostInput(t: TurnRecord): TurnCostInput {
  return {
    input_tokens: t.input_tokens,
    output_tokens: t.output_tokens,
    cache_creation_input_tokens: t.cache_creation_input_tokens,
    cache_read_input_tokens: t.cache_read_input_tokens,
    model: t.model,
  };
}

/**
 * Compute the status bar stats (always account-wide, not filtered).
 */
export function computeStatusBar(
  window: WindowRecord | undefined,
  currentIsPeak: boolean,
  lastTurn: TurnRecord | undefined,
  modelContextWindows: ModelContextWindows,
  weeklyTurns: TurnRecord[],
  currency: string,
): StatusBarStats {
  const contextUsed = lastTurn
    ? lastTurn.input_tokens + lastTurn.cache_creation_input_tokens + lastTurn.cache_read_input_tokens
    : 0;

  let contextMax = 200_000;
  if (lastTurn?.model && lastTurn.model in modelContextWindows) {
    contextMax = modelContextWindows[lastTurn.model].context_window;
  }

  // Burn rate from all recent turns (account-wide)
  const burnRate = computeBurnRate(weeklyTurns, Date.now());

  let weeklyTokens = 0;
  let weeklyCostMinor = 0;
  for (const t of weeklyTurns) {
    weeklyTokens += t.input_tokens + t.output_tokens;
    weeklyCostMinor += turnCostMinor(toTurnCostInput(t), currency);
  }

  return {
    isPeak: currentIsPeak,
    contextUsed,
    contextMax,
    burnRate,
    weeklyTokens,
    weeklyCostMinor,
    currency,
  };
}

/**
 * Map SessionRecords to the ActiveSessionInfo shape the message contract expects.
 */
export function toActiveSessionInfoList(sessions: SessionRecord[]): ActiveSessionInfo[] {
  return sessions.map(s => ({
    sessionId: s.session_id,
    projectName: s.project_name,
    lastActivity: s.last_activity_at,
    firstSeen: s.first_seen_at,
  }));
}
