# 0014 — Single pricing.json source of truth

**Status.** Accepted

**Date.** 2026-04-08

**Context.** Pip-Token shows estimated API-equivalent cost on STATS/COST and in the status bar's WK segment. Token-to-cost calculation requires per-model pricing data (input price per million tokens, output price per million tokens), and Anthropic adjusts these prices occasionally. Pricing data could be hardcoded across multiple files, fetched at runtime from Anthropic's docs, or centralised in one config file.

**Decision.** Pricing lives in a single JSON file at `src/domain/pricing.json`. The file contains per-model prices, the date the snapshot was taken, the source URL on Anthropic's docs, and the fixed currency exchange rate snapshot. All cost calculations across the extension read from this one file. When Anthropic changes prices, the maintainer edits this file once and the change propagates everywhere.

**Consequences.** Updates are trivial — one file edit, one PR, one deploy. The date stamp inside the file lets users see how stale the pricing is. There's no risk of one part of the codebase using stale prices because another file was updated. The downside is that pricing is not live — users see whatever was in the file at the last release. We accept this because price changes are infrequent and the alternative (live fetching) would violate ADR 0004.

**Alternatives considered.**
- Hardcode prices in `costCalculator.ts` (rejected — easy to forget to update, and would need to be hardcoded again wherever cost is calculated)
- Fetch pricing from Anthropic's docs at runtime (rejected — violates the no-network-calls rule from ADR 0004)
- Pull pricing from environment variables (rejected — pushes the burden onto users)
