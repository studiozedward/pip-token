# src/domain/ — Business Logic Conventions

## Single sources of truth

- **Pricing:** `pricing.json` — never hardcode prices anywhere else
- **Peak hours:** `peakHourSchedule.ts` — never hardcode the window anywhere else
- **Plan tier defaults:** `planTierDefaults.ts` — single source for cold-start estimates

## Money math

All money calculations use integers in minor units (pence, cents). Convert to display format at the point of rendering, never earlier.

## Date handling

All dates are stored as ISO 8601 in UTC. Convert to local timezone at display time only.

## Context estimation

Context window usage must include all three input token fields: `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`. Using only `input_tokens` massively undercounts when prompt caching is active.

## Burn rate states

`computeBurnRate()` returns `number | 'LEARNING' | 'STALE'` — never collapse these into a single null. LEARNING = too few turns for a meaningful rate. STALE = had turns but none within the 10-minute window. The UI renders the label directly.

## Settings at point of use

Always read user settings from the DB at the point of computation: `getSetting('currency') ?? getDefaultCurrency()`. Never call `getDefaultCurrency()` alone in page builders — the user's stored preference must take priority.

## Advisory engine

- Rules live in `advisoryRules.ts` as a static array — never inline rules in pages
- The engine evaluates rules per page and returns the highest-priority match
