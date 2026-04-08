# 0013 — Cache TTL assumed 5 minutes

**Status.** Accepted

**Date.** 2026-04-08

**Context.** Anthropic offers two prompt cache TTLs: 5 minutes (default) and 1 hour (extended). Both are set on the API call by Claude Code, not by the user. Pip-Token can't reliably detect which TTL is in use from log data alone — the field may not exist in the JSONL. Cache state and cache savings calculations depend on knowing the TTL.

**Decision.** Pip-Token hardcodes the 5-minute cache TTL assumption universally. The `CACHE TYPE` row was removed from LIVE/CACHE entirely. Documentation in ABOUT and GLOSSARY notes the assumption clearly. Detection of the active TTL is deferred to v2.

**Consequences.** The assumption is correct for the vast majority of Claude Code sessions because 5 minutes is the default. Users on the 1-hour cache will see their cache marked EXPIRED long before it actually has — a known false-negative we tolerate. The cache savings figure may overstate savings by ~5x for 1-hour cache users, which is also flagged. The page is conceptually simpler and easier to build.

**Alternatives considered.**
- Detect the active TTL from JSONL fields (deferred to v2 — depends on Q2 in TOKEN_DATA_RESEARCH.md)
- Let the user select their TTL in settings (rejected — most users don't know which they're using and shouldn't have to)
- Show both TTLs in parallel (rejected — confusing and visually noisy)
- Cut the cache page entirely (deferred — fallback option if the cache fields turn out not to exist in JSONL at all)
