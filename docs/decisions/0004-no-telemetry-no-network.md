# 0004 — No telemetry, no network calls without consent

**Status.** Accepted

**Date.** 2026-04-08

**Context.** Several Pip-Token features could be improved by a backend: crowdsourced threshold defaults for new users, community tip submissions, anonymous usage analytics for prioritising features. But each of these introduces dependencies, privacy considerations, and ongoing maintenance burden. The target audience — developers frustrated with Anthropic's opaque limits — is particularly sensitive to telemetry.

**Decision.** Pip-Token makes **no network calls without explicit user consent**. v1 ships with zero network calls of any kind: no telemetry, no remote update checks, no font CDNs, no server-seeded thresholds. All data lives in a SQLite database in VS Code's per-extension storage directory. The extension declares no network permissions in `package.json` and the README states this guarantee prominently.

The "without consent" wording leaves room for a future opt-in analytics workflow in v2, where users could explicitly enable anonymous aggregate analytics to help improve the project. Any such workflow would be opt-in only (default off), with full disclosure of what gets collected, and would itself require a new ADR superseding this one.

**Consequences.** Users on Reddit and Discord — the target audience — get a clean "no network calls by default, ever" guarantee that's a real differentiator. Cold start is purely from plan tier defaults rather than community averages. Bug reports rely on users opening GitHub issues, not on automatic crash reports. v2 has a clear path to opt-in analytics if the project warrants it, without breaking the v1 promise.

**Alternatives considered.**
- Always-on telemetry (rejected — erodes trust with the target audience)
- Opt-out telemetry (rejected — particularly distrusted by privacy-conscious users; GDPR risks)
- Opt-in telemetry in v1 (deferred to v2 — substantial build scope, defer until user base justifies the infrastructure)
- Permanent "no network calls, ever" guarantee (rejected — closes the door on future improvements that real users might genuinely want)
