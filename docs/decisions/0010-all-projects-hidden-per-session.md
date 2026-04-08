# 0010 — `[ALL PROJECTS]` aggregation hidden on per-session pages

**Status.** Accepted

**Date.** 2026-04-08

**Context.** Most data pages (LIVE/SESSION, STATS, HISTORY) aggregate data across all active sessions because Anthropic's limits are account-wide and the honest view is the aggregated one. But two pages — LIVE/CONTEXT and LIVE/CACHE — are fundamentally per-session. Each session has its own context window with its own fill, and its own prompt cache state. Aggregating across sessions makes no conceptual sense for these.

**Decision.** The project selector dropdown on LIVE/CONTEXT and LIVE/CACHE hides the `[ALL PROJECTS]` option entirely. Both pages default to the most recently active session and require the user to pick a single session. If no sessions are active, the page shows a friendly empty state.

**Consequences.** Users on these pages get an honest view of one session's state rather than a meaningless average. The selector behaviour is inconsistent across LIVE pages — ALL is available on SESSION but not on CONTEXT or CACHE. We accept this inconsistency because forcing aggregation where it doesn't fit would be worse than the inconsistency.

**Alternatives considered.**
- Show `[ALL PROJECTS]` everywhere with an averaged view on per-session pages (rejected — averaging context fill across sessions is meaningless and misleading)
- Show `[ALL PROJECTS]` on per-session pages with an explanatory dead-screen ("pick a session to see this") (rejected — the user said no point having a dead screen)
- Hide the selector entirely on per-session pages (rejected — users still need to switch between sessions)
