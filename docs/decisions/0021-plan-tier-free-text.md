# 0021 — Plan tier as free-text string backed by defaults file

**Status.** Accepted

**Date.** 2026-04-08

**Context.** DESIGN.md §7 defines `plan_tier` as an enum (FREE, PRO, MAX_5X, MAX_20X). Anthropic's plan structure changes occasionally — Team plans exist, tier names have been reshuffled, and Max tiers were introduced mid-2025. A hardcoded enum means new tiers require a code change.

**Decision.** Treat `plan_tier` as a free-text string in the database and settings, backed by the values in `planTierDefaults.ts`. The onboarding dropdown reads its options from the same file. When Anthropic adds a tier, update one file. Users pick "closest tier" if theirs isn't listed.

**Consequences.** Adding a new plan tier is a one-file change to `planTierDefaults.ts`. No database migration needed. The downside is that free-text allows typos or invalid values, but since the UI uses a dropdown populated from the same source file, this is unlikely in practice.

**Alternatives considered.**
- Hardcoded enum with OTHER value (rejected — still requires a code change for common cases)
- Hardcoded enum only (rejected — brittle when Anthropic changes plans)
