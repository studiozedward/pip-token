/**
 * Advisory rules for the Pip-Boy advisory bar.
 * Each rule targets specific pages and fires when its condition is met.
 * The engine picks the highest-priority match per page.
 *
 * All messages are UPPERCASE to match the Pip-Boy aesthetic.
 */

import type { AdvisoryRule, AdvisoryContext } from './advisoryEngine';
import { formatCompact } from '../utils/formatNumber';

// --- Helpers ---

function burnMultiplier(ctx: AdvisoryContext): string {
  if (
    ctx.burnRate != null &&
    ctx.historicalAvgBurnRate != null &&
    ctx.historicalAvgBurnRate > 0
  ) {
    return (ctx.burnRate / ctx.historicalAvgBurnRate).toFixed(1);
  }
  return '?';
}

// --- Rule definitions ---

export const ADVISORY_RULES: AdvisoryRule[] = [
  // ==========================================
  // LIVE/SESSION (page: 'live.session')
  // ==========================================
  {
    pages: ['live.session'],
    priority: 8,
    condition: (ctx: AdvisoryContext) =>
      ctx.burnRate != null &&
      ctx.historicalAvgBurnRate != null &&
      ctx.historicalAvgBurnRate > 0 &&
      ctx.burnRate > ctx.historicalAvgBurnRate * 1.5,
    message: (ctx: AdvisoryContext) =>
      `BURN RATE IS UNUSUALLY HIGH — YOU'RE USING ${burnMultiplier(ctx)}X YOUR TYPICAL PACE.`,
  },
  {
    pages: ['live.session'],
    priority: 6,
    condition: (ctx: AdvisoryContext) =>
      ctx.sessionTimeSeconds != null && ctx.sessionTimeSeconds > 14400,
    message: () =>
      'LONG SESSION DETECTED — CONSIDER BREAKING UP TASKS TO KEEP CACHE FRESH.',
  },
  {
    pages: ['live.session'],
    priority: 4,
    condition: (ctx: AdvisoryContext) =>
      ctx.projectFilter != null && ctx.projectFilter !== '',
    message: (ctx: AdvisoryContext) =>
      `SHOWING ${ctx.projectFilter?.toUpperCase() ?? ''} ONLY — STATUS BAR STILL REFLECTS ALL PROJECTS.`,
  },

  // ==========================================
  // LIVE/CONTEXT (page: 'live.context')
  // ==========================================
  {
    pages: ['live.context'],
    priority: 8,
    condition: (ctx: AdvisoryContext) =>
      ctx.utilisation != null && ctx.utilisation > 80,
    message: (ctx: AdvisoryContext) =>
      `CONTEXT IS ${Math.round(ctx.utilisation ?? 0)}% FULL — CONSIDER /CLEAR BEFORE NEXT TASK.`,
  },
  {
    pages: ['live.context'],
    priority: 6,
    condition: (ctx: AdvisoryContext) =>
      ctx.utilisation != null && ctx.utilisation > 60,
    message: () =>
      'CONTEXT IS FILLING UP. CONSIDER /CLEAR IF YOU\'RE SWITCHING TASKS.',
  },

  // ==========================================
  // LIVE/CACHE (page: 'live.cache')
  // ==========================================
  {
    pages: ['live.cache'],
    priority: 8,
    condition: (ctx: AdvisoryContext) => ctx.cacheState === 'EXPIRED',
    message: () =>
      'CACHE EXPIRED. NEXT TURN WILL RE-READ FULL CONTEXT AT BASE PRICE.',
  },
  {
    pages: ['live.cache'],
    priority: 7,
    condition: (ctx: AdvisoryContext) =>
      ctx.hitRate != null && ctx.hitRate > 70,
    message: (ctx: AdvisoryContext) =>
      `CACHE HIT RATE IS ${Math.round(ctx.hitRate ?? 0)}% TODAY — SAVING YOU ~${formatCompact(ctx.savedToday ?? 0)} TOKENS. AVOID 5+ MINUTE BREAKS TO KEEP IT FRESH.`,
  },
  {
    pages: ['live.cache'],
    priority: 5,
    condition: (ctx: AdvisoryContext) =>
      ctx.hitRate != null && ctx.hitRate < 40,
    message: () =>
      'CACHE HIT RATE IS LOW — FREQUENT BREAKS MAY BE CAUSING EXPENSIVE CACHE REBUILDS.',
  },

  // ==========================================
  // HISTORY/WEEK (page: 'history.week')
  // ==========================================
  {
    pages: ['history.week'],
    priority: 7,
    condition: (ctx: AdvisoryContext) =>
      ctx.peakPercent != null && ctx.peakPercent > 50,
    message: (ctx: AdvisoryContext) =>
      `${Math.round(ctx.peakPercent ?? 0)}% OF YOUR TOKENS THIS WEEK RAN DURING PEAK HOURS. SHIFTING HEAVY WORK TO EVENINGS COULD REDUCE LIMIT HITS.`,
  },
  {
    pages: ['history.week'],
    priority: 6,
    condition: (ctx: AdvisoryContext) =>
      ctx.limitHitCount != null && ctx.limitHitCount > 0,
    message: (ctx: AdvisoryContext) =>
      `YOU HIT LIMITS ${ctx.limitHitCount ?? 0} TIMES THIS PERIOD.`,
  },
  {
    pages: ['history.week'],
    priority: 3,
    condition: (ctx: AdvisoryContext) => ctx.isPastPeriod === true,
    message: () => 'VIEWING PAST WEEK. CLICK \u25B6 TO MOVE FORWARD.',
  },

  // ==========================================
  // HISTORY/MONTH (page: 'history.month')
  // ==========================================
  {
    pages: ['history.month'],
    priority: 7,
    condition: (ctx: AdvisoryContext) =>
      ctx.heaviestWeekMultiplier != null && ctx.heaviestWeekMultiplier >= 2,
    message: (ctx: AdvisoryContext) =>
      `${(ctx.heaviestWeekLabel ?? '').toUpperCase()} WAS UNUSUALLY HEAVY — ${(ctx.heaviestWeekMultiplier ?? 0).toFixed(1)}X YOUR MONTHLY DAILY AVERAGE.`,
  },
  {
    pages: ['history.month'],
    priority: 3,
    condition: (ctx: AdvisoryContext) => ctx.isPastPeriod === true,
    message: () => 'VIEWING PAST MONTH. CLICK \u25B6 TO MOVE FORWARD.',
  },

  // ==========================================
  // HISTORY/QUARTER (page: 'history.quarter')
  // ==========================================
  {
    pages: ['history.quarter'],
    priority: 3,
    condition: (ctx: AdvisoryContext) => ctx.isPastPeriod === true,
    message: () => 'VIEWING PAST QUARTER. CLICK \u25B6 TO MOVE FORWARD.',
  },

  // ==========================================
  // HISTORY/YEAR (page: 'history.year')
  // ==========================================
  {
    pages: ['history.year'],
    priority: 3,
    condition: (ctx: AdvisoryContext) => ctx.isPastPeriod === true,
    message: () => 'VIEWING PAST YEAR. CLICK \u25B6 TO MOVE FORWARD.',
  },

  // ==========================================
  // STATS/TOKENS (page: 'stats.tokens')
  // ==========================================
  {
    pages: ['stats.tokens'],
    priority: 7,
    condition: (ctx: AdvisoryContext) =>
      ctx.peakPercent != null && ctx.peakPercent > 50,
    message: (ctx: AdvisoryContext) =>
      `${Math.round(ctx.peakPercent ?? 0)}% OF RECENT TOKENS RAN DURING PEAK HOURS.`,
  },
  {
    pages: ['stats.tokens'],
    priority: 6,
    condition: (ctx: AdvisoryContext) =>
      ctx.limitHitCount != null && ctx.limitHitCount > 0,
    message: (ctx: AdvisoryContext) =>
      `YOU'VE HIT LIMITS ${ctx.limitHitCount ?? 0} TIMES IN THIS PERIOD.`,
  },
];
