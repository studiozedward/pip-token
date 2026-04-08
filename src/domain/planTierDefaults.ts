/**
 * Plan tier cold-start defaults — single source of truth.
 * These are community-sourced estimates used when the user has no personal
 * limit-hit history. They are clearly labelled as estimates in the UI.
 * See ADR 0021 (free-text plan tier) and DESIGN.md §12.
 *
 * Sources: Reddit/Discord community reports, April 2026.
 * Re-verify before M7 shipping (TODO.md item 4).
 */

export interface PlanTierDefaults {
  label: string;
  sessionInputTokenEstimate: number;
  weeklyInputTokenEstimate: number;
  price: string;
}

export const PLAN_TIERS: Record<string, PlanTierDefaults> = {
  free: {
    label: 'Free',
    sessionInputTokenEstimate: 25_000,
    weeklyInputTokenEstimate: 150_000,
    price: '$0/mo',
  },
  pro: {
    label: 'Pro',
    sessionInputTokenEstimate: 225_000,
    weeklyInputTokenEstimate: 1_500_000,
    price: '$20/mo',
  },
  max_5x: {
    label: 'Max 5x',
    sessionInputTokenEstimate: 1_100_000,
    weeklyInputTokenEstimate: 7_500_000,
    price: '$100/mo',
  },
  max_20x: {
    label: 'Max 20x',
    sessionInputTokenEstimate: 4_500_000,
    weeklyInputTokenEstimate: 30_000_000,
    price: '$200/mo',
  },
};

/** Get defaults for a tier, or undefined if unknown */
export function getTierDefaults(tier: string): PlanTierDefaults | undefined {
  return PLAN_TIERS[tier.toLowerCase()];
}

/** Get all tier keys for populating dropdowns */
export function getTierKeys(): string[] {
  return Object.keys(PLAN_TIERS);
}
