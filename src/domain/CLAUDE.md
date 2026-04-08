# src/domain/ — Business Logic Conventions

## Single sources of truth

- **Pricing:** `pricing.json` — never hardcode prices anywhere else
- **Peak hours:** `peakHourSchedule.ts` — never hardcode the window anywhere else
- **Plan tier defaults:** `planTierDefaults.ts` — single source for cold-start estimates

## Money math

All money calculations use integers in minor units (pence, cents). Convert to display format at the point of rendering, never earlier.

## Date handling

All dates are stored as ISO 8601 in UTC. Convert to local timezone at display time only.

## Advisory engine

- Rules live in `advisoryRules.ts` as a static array — never inline rules in pages
- The engine evaluates rules per page and returns the highest-priority match
