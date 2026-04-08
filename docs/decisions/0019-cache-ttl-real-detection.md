# 0019 — Cache TTL detection from real JSONL fields

**Status.** Accepted (supersedes 0013)

**Date.** 2026-04-08

**Context.** ADR 0013 assumed a 5-minute cache TTL universally because we didn't know if real TTL data was available in the logs. Investigation of Claude Code JSONL (version 2.1.87) revealed that `message.usage.cache_creation` contains `ephemeral_5m_input_tokens` and `ephemeral_1h_input_tokens`, which reveal which TTL tier is active per turn.

**Decision.** Use real cache TTL detection from JSONL fields instead of the hardcoded 5-minute assumption. The parser reads `cache_creation.ephemeral_5m_input_tokens` and `cache_creation.ephemeral_1h_input_tokens` to determine which TTL is active. If `ephemeral_1h_input_tokens > 0`, the session is using 1-hour cache. Otherwise, 5-minute cache. LIVE/CACHE displays the actual active TTL.

**Consequences.** Cache status and expiry timers are now accurate for both 5-minute and 1-hour cache users. The CACHE TYPE row can be restored to the LIVE/CACHE page (it was removed in ADR 0013). Users on 1-hour cache no longer see false EXPIRED warnings. If the fields disappear in a future Claude Code version, the parser falls back to the 5-minute assumption from ADR 0013.

**Alternatives considered.**
- Keep the 5-minute assumption from ADR 0013 (rejected — real data is available and more accurate)
- Detect TTL from timing gaps between turns (rejected — unreliable and the explicit fields are better)
