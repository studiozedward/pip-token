/**
 * Simple rules engine for advisory messages.
 * Each rule declares which pages it applies to, a condition, a message formatter,
 * and a priority. The engine evaluates all rules for a given page and returns
 * the highest-priority matching message.
 */

export interface AdvisoryRule {
  pages: string[];
  condition: (ctx: AdvisoryContext) => boolean;
  message: (ctx: AdvisoryContext) => string;
  priority: number;
}

export interface AdvisoryContext {
  pageId: string;
  // Live session data
  burnRate?: number | null;
  historicalAvgBurnRate?: number | null;
  sessionTimeSeconds?: number;
  projectFilter?: string | null;
  // Context data
  utilisation?: number;
  // Cache data
  cacheState?: string;
  hitRate?: number;
  hitsToday?: number;
  missesToday?: number;
  savedToday?: number;
  // History/stats data
  peakPercent?: number;
  limitHitCount?: number;
  periodLabel?: string;
  busiestDayLabel?: string;
  busiestDayTokens?: number;
  isPastPeriod?: boolean;
  heaviestWeekLabel?: string;
  heaviestWeekMultiplier?: number;
}

/**
 * Evaluate all rules for the given page. Return the highest-priority
 * matching advisory message, or null.
 */
export function evaluateAdvisory(rules: AdvisoryRule[], ctx: AdvisoryContext): string | null {
  let bestRule: AdvisoryRule | null = null;

  for (const rule of rules) {
    if (!rule.pages.includes(ctx.pageId)) continue;
    try {
      if (rule.condition(ctx)) {
        if (!bestRule || rule.priority > bestRule.priority) {
          bestRule = rule;
        }
      }
    } catch {
      // Skip rules that error — defensive
    }
  }

  if (!bestRule) return null;

  try {
    return bestRule.message(ctx);
  } catch {
    return null;
  }
}
