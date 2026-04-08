# Pip-Token — Initial ADRs

The 18 initial Architecture Decision Records, drafted from our design conversations. These will be split into individual numbered files in `docs/decisions/` during Milestone 0 — `0001-monochrome-only.md`, `0002-no-vscode-status-bar.md`, and so on through `0018-sqlite-concurrency.md`.

Format for each ADR:
- **Status** — Accepted, Superseded, or Deprecated
- **Date** — when the decision was made
- **Context** — what problem were we deciding about
- **Decision** — what we decided
- **Consequences** — what this means for the project
- **Alternatives considered** — what else we looked at and why we passed

Each ADR is intentionally short. If a decision needs more than 300 words to explain, it's probably two decisions.

---

## 0001 — Monochrome aesthetic only

**Status:** Accepted
**Date:** 2026-04-08

**Context.** We needed to decide whether Pip-Token's Pip-Boy aesthetic should allow any colour beyond phosphor green. Multi-colour schemes are visually richer but dilute the Fallout Pip-Boy identity, which is uncompromisingly monochrome.

**Decision.** Pip-Token uses monochrome phosphor green throughout (`#00ff41` primary, with mid and dim tiers for hierarchy). Red (`#ff4141`) is the only exception, reserved exclusively for alarm states: the PEAK status badge when in peak hours, and limit hit markers in charts.

**Consequences.** Strong visual identity and instant recognition. Red gains real semantic weight because it's never decorative — when users see red, something needs attention. Charts must use opacity tiers to differentiate categories rather than colour. Mascot art is constrained to vector linework in green. Future contributors must resist the urge to add accent colours for emphasis.

**Alternatives considered.**
- Multi-colour scheme similar to modern dashboards (rejected — breaks Pip-Boy authenticity)
- Greyscale with green accents (rejected — loses the phosphor feel)
- Allowing accent colours for chart categories (rejected — would dilute the alarm meaning of red)
- Dark amber instead of green (rejected — Pip-Boy 3000 in Fallout 4 is green; this is the canonical reference)

---

## 0002 — No VS Code native status bar in v1

**Status:** Accepted
**Date:** 2026-04-08

**Context.** Earlier drafts of the spec included two status bar renderings: one inside the extension webview, and one in VS Code's persistent bottom strip via the `StatusBarItem` API. The native version would be visible at all times, even when the extension panel is closed, providing peripheral awareness.

**Decision.** v1 ships with the in-window status bar only. The VS Code-native bottom-strip rendering is removed from v1 scope and reconsidered for v2 if users specifically request it.

**Consequences.** The user only sees status information when the extension panel is open. They lose the "glance value" of always-visible peak/burn/cost data while heads-down in code. Maintenance surface is smaller — we don't need to keep two renderings in sync. The build is faster because we don't have to handle the limited colour and text constraints of VS Code's native API.

**Alternatives considered.**
- Build both renderings as originally specified (rejected — limited value relative to build cost; the constrained native version would look ugly)
- Build only the VS Code native version (rejected — loses the full coloured Pip-Boy aesthetic)
- Build a minimal native version with just a peak/off-peak indicator (deferred to v2 — possibly the right v2 path)

---

## 0003 — Peak/off-peak as raw counters, not inferred multipliers

**Status:** Accepted
**Date:** 2026-04-08

**Context.** Anthropic's session limits are consumed faster during peak hours (weekdays 5–11am Pacific) but the exact multiplier is undocumented and changes silently. Pip-Token needs to project "time to limit" accurately. Two approaches were possible: infer the peak multiplier by correlating local token counts with dashboard percentages, or track peak and off-peak as separate raw counters and let the user's own limit-hit history reveal the relationship empirically.

**Decision.** Pip-Token tracks `peak_tokens` and `offpeak_tokens` as two parallel counters. When the user hits a limit, Pip-Token records the snapshot of both counters at the moment of the hit. Over multiple hits, this becomes a personal threshold: "your last 5 limit hits averaged 180k peak / 50k off-peak." Projections come from the user's own history, not from any inferred Anthropic constant.

**Consequences.** Pip-Token never has to guess the multiplier. When Anthropic silently changes the rules, the next limit hit automatically updates the user's threshold. The downside is that brand-new users have no personal threshold and must wait for their first hit before EST. TIME TO LIMIT becomes meaningful — the LEARNING state covers this.

**Alternatives considered.**
- Infer a multiplier from dashboard correlation (rejected — fragile and presents inferred numbers as facts)
- Hardcode a community-sourced multiplier (rejected — stale immediately after Anthropic adjustments)
- Skip peak/off-peak tracking entirely (rejected — peak hours are the most actionable signal Pip-Token offers)

---

## 0004 — No telemetry, no network calls without consent

**Status:** Accepted
**Date:** 2026-04-08

**Context.** Several Pip-Token features could be improved by a backend: crowdsourced threshold defaults for new users, community tip submissions, anonymous usage analytics for prioritising features. But each of these introduces dependencies, privacy considerations, and ongoing maintenance burden. The target audience — developers frustrated with Anthropic's opaque limits — is particularly sensitive to telemetry.

**Decision.** Pip-Token makes **no network calls without explicit user consent**. v1 ships with zero network calls of any kind: no telemetry, no remote update checks, no font CDNs, no server-seeded thresholds. All data lives in a SQLite database in VS Code's per-extension storage directory. The extension declares no network permissions in `package.json` and the README states this guarantee prominently.

The "without consent" wording leaves room for a future opt-in analytics workflow in v2, where users could explicitly enable anonymous aggregate analytics to help improve the project. Any such workflow would be opt-in only (default off), with full disclosure of what gets collected, and would itself require a new ADR superseding this one.

**Consequences.** Users on Reddit and Discord — the target audience — get a clean "no network calls by default, ever" guarantee that's a real differentiator. Cold start is purely from plan tier defaults rather than community averages. Bug reports rely on users opening GitHub issues, not on automatic crash reports. v2 has a clear path to opt-in analytics if the project warrants it, without breaking the v1 promise.

**Alternatives considered.**
- Always-on telemetry (rejected — erodes trust with the target audience)
- Opt-out telemetry (rejected — particularly distrusted by privacy-conscious users; GDPR risks)
- Opt-in telemetry in v1 (deferred to v2 — substantial build scope, defer until user base justifies the infrastructure)
- Permanent "no network calls, ever" guarantee (rejected — closes the door on future improvements that real users might genuinely want)

---

## 0005 — Distributed CLAUDE.md pattern

**Status:** Accepted
**Date:** 2026-04-08

**Context.** Claude Code reads `CLAUDE.md` files for project context. A single root file works for small projects but becomes a noisy dumping ground as conventions accumulate, with parser quirks living next to webview gotchas living next to commit conventions. Boris Cherny has written about a distributed pattern where each subdirectory carries its own CLAUDE.md with locally-relevant context, loaded automatically when Claude Code is working in that area.

**Decision.** Pip-Token uses a distributed CLAUDE.md pattern. The root CLAUDE.md is short (target under 100 lines) and contains only project-wide context: tech stack, build commands, branching conventions, hard rules. Subdirectory CLAUDE.md files live in `src/`, `src/parsing/`, `src/webview/`, `src/data/`, `src/domain/`, and `test/`, each containing conventions specific to that subsystem.

**Consequences.** Subsystem context appears at the right time without overwhelming the global context window. Adding a new convention has an obvious home — the closest CLAUDE.md to where the convention applies. The root file stays scannable. Contributors can find local conventions next to the code they're touching rather than searching a giant document.

**Alternatives considered.**
- Single root CLAUDE.md with section headers (rejected — becomes unwieldy as the project grows)
- No CLAUDE.md, rely on inline comments (rejected — comments don't survive refactoring and aren't auto-loaded by Claude Code)
- Use CONTRIBUTING.md instead (rejected — that's for human contributors, not for Claude Code's working memory)

---

## 0006 — SQLite via better-sqlite3

**Status:** Accepted
**Date:** 2026-04-08

**Context.** Pip-Token needs persistent local storage for token counters, limit hit events, dashboard syncs, and settings. The choices are: a flat JSON file, a key-value store, or a relational database. Performance matters because the database is queried on every webview update.

**Decision.** SQLite via the `better-sqlite3` Node.js library. Single file stored in VS Code's `globalStorageUri` per-extension directory. All access goes through a thin repository layer.

**Consequences.** `better-sqlite3` provides a synchronous API, which simplifies the data access code (no async/await ceremony for trivial reads). SQL is well-known and maintenance-friendly. Schema migrations are straightforward via numbered SQL files. Memory footprint is small. The downside is that `better-sqlite3` is a native module and must be rebuilt for each Node version and platform — VS Code extensions handle this via the marketplace, but local development needs `npm rebuild` after Node updates.

**Alternatives considered.**
- Flat JSON file (rejected — doesn't scale to a year of historical data, no query language)
- LevelDB / lmdb (rejected — key-value stores require manual indexing for the queries we need)
- IndexedDB in the webview (rejected — webview storage doesn't survive extension reloads cleanly)
- A remote database (rejected — see ADR 0004, no backend)

---

## 0007 — Hand-rolled SVG charts

**Status:** Accepted
**Date:** 2026-04-08

**Context.** Pip-Token displays bar charts on STATS, HISTORY, and several LIVE pages. The natural choice for a TypeScript project would be Chart.js, D3, or Recharts. But Pip-Token's aesthetic is highly opinionated — chunky monospace labels, specific opacity tiers for stacked bars, red alarm markers in specific positions, no animations — and chart libraries are designed to fit modern dashboard conventions, not retro CRT aesthetics.

**Decision.** All charts are hand-rolled inline SVG. The mockups in `mockups/*.html` demonstrate the approach. A small set of helper functions in `src/webview/ui/components/` (`barChart.ts`, etc.) handles the common patterns.

**Consequences.** The aesthetic stays pixel-perfect because we control every element. Bundle size is significantly smaller — a chart library is hundreds of kilobytes; our helpers are kilobytes. There are no library upgrades to manage. The downside is that any new chart type (e.g. line charts, if we add them in v2) must be built from scratch.

**Alternatives considered.**
- Chart.js (rejected — fights the aesthetic at every turn, especially the no-animation requirement)
- D3 (rejected — too much abstraction for our simple needs; we'd write helpers around D3 anyway)
- Recharts (rejected — React-only, and we deliberately don't use React)
- Plain canvas (rejected — SVG is more accessible and easier to debug in browser DevTools)

---

## 0008 — Plain HTML webview, no frontend framework

**Status:** Accepted
**Date:** 2026-04-08

**Context.** VS Code webviews can host any web technology. Most extensions use React or Vue for non-trivial UI. Pip-Token has a moderate amount of UI: 13 pages, dynamic charts, live updates from the extension host.

**Decision.** Pip-Token's webview is plain TypeScript, plain HTML, plain CSS. No React, no Vue, no Svelte, no Tailwind. State is held in module-level variables; updates from the extension host trigger plain DOM updates via small render functions per page.

**Consequences.** The bundle is small. Build time is fast. There are no framework upgrades to chase. Anyone reading the code only needs to know HTML/CSS/TS, not framework-specific patterns. The downside is that we manually wire up DOM updates instead of relying on a reactive framework — this is fine for 13 pages but would become painful at 50+. We're explicitly accepting that limit.

**Alternatives considered.**
- React (rejected — adds complexity and bundle size for a project this size)
- Vue (rejected — same as React)
- Svelte (rejected — would bring real benefits but adds a build step we don't need)
- Lit / Web Components (rejected — would be a reasonable choice but adds nothing over plain DOM for 13 pages)

---

## 0009 — Active session = file modified within 2 hours

**Status:** Accepted
**Date:** 2026-04-08

**Context.** Pip-Token needs to know which Claude Code sessions are "currently active" to populate the project selector dropdown. A session that the user has clearly abandoned (e.g. yesterday's work) shouldn't appear. But a session that paused for a lunch break should remain active when the user returns.

**Decision.** A session is considered active if its backing JSONL file in `~/.claude/projects/` has been modified within the last 2 hours. The 2-hour threshold is hardcoded as a single constant in `src/parsing/activeSessionTracker.ts`.

**Consequences.** Users who take normal breaks (lunch, meetings, school runs) come back to find their sessions still listed. Users who left a session running yesterday don't see stale entries. The 2-hour threshold is a single value to tune if it turns out to be wrong. Edge case: a user with five projects all touched in the last 2 hours sees all five in the picker, which is correct but visually busy — the picker shows last-activity timestamps so the user can make sense of it.

**Alternatives considered.**
- 30 minutes (rejected — too aggressive, would drop sessions during normal breaks)
- 24 hours (rejected — would clutter the picker with yesterday's abandoned work)
- "Until Claude Code closes the file" (rejected — Claude Code doesn't always cleanly close files, so this would lead to many false positives)
- Configurable per user (deferred to v2 — adds settings UI complexity for unclear benefit)

---

## 0010 — `[ALL PROJECTS]` aggregation hidden on per-session pages

**Status:** Accepted
**Date:** 2026-04-08

**Context.** Most data pages (LIVE/SESSION, STATS, HISTORY) aggregate data across all active sessions because Anthropic's limits are account-wide and the honest view is the aggregated one. But two pages — LIVE/CONTEXT and LIVE/CACHE — are fundamentally per-session. Each session has its own context window with its own fill, and its own prompt cache state. Aggregating across sessions makes no conceptual sense for these.

**Decision.** The project selector dropdown on LIVE/CONTEXT and LIVE/CACHE hides the `[ALL PROJECTS]` option entirely. Both pages default to the most recently active session and require the user to pick a single session. If no sessions are active, the page shows a friendly empty state.

**Consequences.** Users on these pages get an honest view of one session's state rather than a meaningless average. The selector behaviour is inconsistent across LIVE pages — ALL is available on SESSION but not on CONTEXT or CACHE. We accept this inconsistency because forcing aggregation where it doesn't fit would be worse than the inconsistency.

**Alternatives considered.**
- Show `[ALL PROJECTS]` everywhere with an averaged view on per-session pages (rejected — averaging context fill across sessions is meaningless and misleading)
- Show `[ALL PROJECTS]` on per-session pages with an explanatory dead-screen ("pick a session to see this") (rejected — the user said no point having a dead screen)
- Hide the selector entirely on per-session pages (rejected — users still need to switch between sessions)

---

## 0011 — LEARNING state instead of zeros or fake projections

**Status:** Accepted
**Date:** 2026-04-08

**Context.** Several Pip-Token metrics require warmup data before they become meaningful: BURN RATE needs 5 minutes of activity, EST. TIME TO LIMIT needs at least one historical limit hit, projection metrics need several weeks of data. The lazy approach is to show zeros or made-up defaults during warmup. This would be dishonest and would erode user trust the moment users notice.

**Decision.** All metrics with warmup or cold-start dependencies show a `LEARNING` placeholder string instead of fabricated values. Variants like `LEARNING — WAIT 5 MINS`, `LEARNING — NEEDS LIMIT HIT`, and `LEARNING — NEEDS SYNC` tell the user what they're waiting for — see GLOSSARY.md for the canonical list. The ABOUT page explains each LEARNING state. Once data accumulates, the placeholder automatically resolves to a real value with no UI reload needed.

**Consequences.** New users see a sparser dashboard for the first few sessions, which may feel underwhelming. We accept this as the cost of honesty. Users who do see numbers can trust them, which is more valuable than impressive-looking fake data on day one. The LEARNING state also visually distinguishes "we don't know yet" from "the value is genuinely zero."

**Alternatives considered.**
- Show zeros (rejected — looks broken and misleading)
- Show plan-tier-defaulted projections from day 1 (rejected — would mislead users into trusting numbers based on community averages, not their actual usage)
- Hide projection fields entirely until ready (rejected — leaves the UI looking patchy and inconsistent)

---

## 0012 — Manual dashboard sync for chat/API usage

**Status:** Accepted
**Date:** 2026-04-08

**Context.** Pip-Token reads Claude Code's local session logs, which means it can't see usage from Claude.ai chat, the mobile app, or third-party tools that hit the Anthropic API directly. Anthropic's 5-hour and weekly limits are account-wide, so users who split work between Claude Code and chat will see Pip-Token's projections drift from reality. Three solutions were possible: a browser extension companion to capture chat traffic, a manual sync workflow, or accepting the limitation.

**Decision.** Pip-Token offers a manual dashboard sync workflow in v1. The user opens Anthropic's Settings → Usage page, reads the current 5-hour and weekly percentages, and enters them into a small modal in ABOUT. Pip-Token compares the dashboard percentages with its own locally-tracked Claude Code counters and attributes the difference to an `OTHER` source bucket. The browser extension companion is deferred to v2.

**Consequences.** v1 ships with a working solution for mixed-surface users without doubling the build scope. The sync is opt-in — users who only use Claude Code can ignore it entirely. Users who do sync get noticeably more accurate projections. The downside is that sync is manual and decays over time; a sync from 2 days ago is less trustworthy than one from 2 hours ago.

**Alternatives considered.**
- Build a browser extension companion in v1 (rejected — doubles maintenance surface, adds three browsers to support)
- Accept the limitation with no mitigation (rejected — projections would be systematically wrong for a large fraction of the target audience)
- Wait for Anthropic to ship a usage API (rejected — uncertain timeline, not under our control)

---

## 0013 — Cache TTL assumed 5 minutes

**Status:** Accepted
**Date:** 2026-04-08

**Context.** Anthropic offers two prompt cache TTLs: 5 minutes (default) and 1 hour (extended). Both are set on the API call by Claude Code, not by the user. Pip-Token can't reliably detect which TTL is in use from log data alone — the field may not exist in the JSONL. Cache state and cache savings calculations depend on knowing the TTL.

**Decision.** Pip-Token hardcodes the 5-minute cache TTL assumption universally. The `CACHE TYPE` row was removed from LIVE/CACHE entirely. Documentation in ABOUT and GLOSSARY notes the assumption clearly. Detection of the active TTL is deferred to v2.

**Consequences.** The assumption is correct for the vast majority of Claude Code sessions because 5 minutes is the default. Users on the 1-hour cache will see their cache marked EXPIRED long before it actually has — a known false-negative we tolerate. The cache savings figure may overstate savings by ~5x for 1-hour cache users, which is also flagged. The page is conceptually simpler and easier to build.

**Alternatives considered.**
- Detect the active TTL from JSONL fields (deferred to v2 — depends on Q2 in TOKEN_DATA_RESEARCH.md)
- Let the user select their TTL in settings (rejected — most users don't know which they're using and shouldn't have to)
- Show both TTLs in parallel (rejected — confusing and visually noisy)
- Cut the cache page entirely (deferred — fallback option if the cache fields turn out not to exist in JSONL at all)

---

## 0014 — Single pricing.json source of truth

**Status:** Accepted
**Date:** 2026-04-08

**Context.** Pip-Token shows estimated API-equivalent cost on STATS/COST and in the status bar's WK segment. Token-to-cost calculation requires per-model pricing data (input price per million tokens, output price per million tokens), and Anthropic adjusts these prices occasionally. Pricing data could be hardcoded across multiple files, fetched at runtime from Anthropic's docs, or centralised in one config file.

**Decision.** Pricing lives in a single JSON file at `src/domain/pricing.json`. The file contains per-model prices, the date the snapshot was taken, the source URL on Anthropic's docs, and the fixed currency exchange rate snapshot. All cost calculations across the extension read from this one file. When Anthropic changes prices, the maintainer edits this file once and the change propagates everywhere.

**Consequences.** Updates are trivial — one file edit, one PR, one deploy. The date stamp inside the file lets users see how stale the pricing is. There's no risk of one part of the codebase using stale prices because another file was updated. The downside is that pricing is not live — users see whatever was in the file at the last release. We accept this because price changes are infrequent and the alternative (live fetching) would violate ADR 0004.

**Alternatives considered.**
- Hardcode prices in `costCalculator.ts` (rejected — easy to forget to update, and would need to be hardcoded again wherever cost is calculated)
- Fetch pricing from Anthropic's docs at runtime (rejected — violates the no-network-calls rule from ADR 0004)
- Pull pricing from environment variables (rejected — pushes the burden onto users)

---

## 0015 — Public from day 1

**Status:** Accepted
**Date:** 2026-04-08

**Context.** Pip-Token can be developed in two ways: privately until v0.1 is feature-complete and ready to share, or publicly from the first commit with a clear "work in progress" status. The private approach feels safer because nobody sees half-built work. The public approach builds in transparency, attracts feedback early, and may surface contributors.

**Decision.** The repository is created public on GitHub from Milestone 0. The README clearly marks v0.1 as work in progress. The CHANGELOG.md tracks progress milestone by milestone. Issues are open from day 1.

**Consequences.** People who find Pip-Token early see incomplete work, which carries some perception risk. The audience for token-tracking tools (Reddit and Discord users frustrated with Anthropic's opaque limits) is technically literate and accustomed to seeing early-stage projects. Building in public also creates accountability — visible progress is harder to abandon. Early issues help shape the design before it's set in stone. The GitHub commit history becomes a useful artifact in itself, showing how the project evolved.

**Alternatives considered.**
- Private until v0.1 (rejected — delays feedback and risks waiting forever for "ready")
- Public after Milestone 1 once the skeleton clicks through (rejected — splits the difference badly; the design package alone is more interesting than an empty skeleton)
- Public read-only with issues disabled (rejected — kills the feedback loop entirely)

---

## 0016 — MIT License

**Status:** Accepted
**Date:** 2026-04-08

**Context.** Pip-Token is being released publicly on GitHub from day 1 (see ADR 0015). A licence had to be chosen before the first public commit. The choice determines who can use Pip-Token, how they can modify it, and whether commercial forks are allowed.

**Decision.** Pip-Token uses the MIT License. Standard canonical text from https://opensource.org/license/mit, copyright studiozedward.

**Consequences.** Anyone can use, modify, redistribute, and incorporate Pip-Token into commercial products without obligation to share their changes. This maximises adoption — corporate VS Code users can install without legal review hurdles, contributors can fork freely, and the project carries no copyleft strings. The downside is that a well-resourced commercial actor could fork Pip-Token, polish it, and sell it without contributing anything back. We accept this risk because the realistic alternative — a copyleft licence that suppresses adoption — would be worse for a project whose value depends on having users.

**Alternatives considered.**
- Apache 2.0 (rejected — explicit patent grant adds lawyer-friendly complexity that's unnecessary for a project this small; no meaningful benefit over MIT for our use case)
- GPL v3 (rejected — copyleft would force commercial users to publish their modifications, which would suppress adoption with the target audience and contradict the goal of being widely useful)
- Unlicensed / public domain dedication (rejected — leaves users in legal limbo in jurisdictions that don't recognise public domain dedication; MIT is functionally equivalent and globally enforceable)
- BSD 3-Clause (rejected — functionally similar to MIT but slightly less common in the VS Code extension ecosystem; MIT matches convention)

---

## 0017 — Idempotent turn ingestion via content-addressed IDs

**Status:** Accepted
**Date:** 2026-04-08

**Context.** Claude Code's session JSONL files are append-only logs that Pip-Token reads with a file watcher. Two scenarios force the parser to re-read lines it has already processed: (a) VS Code restarts, which reset the watcher's in-memory offset tracking, and (b) any future maintenance that wipes the `watcher_state` offset cache. If each re-read produces a fresh random UUID for the turn, the database happily inserts a second row for the same turn and counters double. Restart VS Code three times during a heavy day and your token counts appear three times higher than reality, with no way to detect or recover from the drift.

**Decision.** Turn IDs are not random UUIDs. They are derived from the turn's own contents: `turn_id = sha256(session_id + "|" + timestamp + "|" + input_tokens + "|" + output_tokens)`, stored as the primary key of the `turns` table. Writes use `INSERT OR IGNORE INTO turns` so duplicate inserts are silently absorbed. The same turn, re-read any number of times, always produces the same ID and never double-counts.

A separate `watcher_state` table tracks file offsets so restarts resume from the right byte position rather than re-reading whole files. This is a performance optimisation on top of the idempotent IDs — if the offset cache is corrupted or wiped, correctness is still guaranteed by the ID scheme.

**Consequences.** Pip-Token's counters stay honest across restarts, file watcher hiccups, parser re-runs on fixture files, and any future "reprocess historical data" features. The hash is deterministic and cheap. The downside is that if Claude Code ever logs two genuinely distinct turns with identical `session_id + timestamp + input_tokens + output_tokens` values (theoretically possible for back-to-back zero-output tool calls), one would be silently dropped — in practice this is vanishingly unlikely, and if it turns out to be a real problem, the hash input can be extended to include a finer-grained field like `model` or `cache_creation_input_tokens`.

**Alternatives considered.**
- Random UUIDs + file offset tracking alone (rejected — offset corruption silently double-counts, no recovery)
- Unique constraint on `(session_id, timestamp, input_tokens, output_tokens)` with random UUIDs (rejected — functionally equivalent to content-addressed IDs but requires a separate composite index and is less obvious to future readers)
- "Mark the file parsed" flag on the sessions table (rejected — doesn't handle partial reads or mid-file re-entry)
- Delete and re-insert on every parse (rejected — destroys audit history and breaks any repository that joins on turn_id)

---

## 0018 — SQLite concurrency: WAL mode, busy_timeout, atomic increments

**Status:** Accepted
**Date:** 2026-04-08

**Context.** `context.globalStorageUri` is per-extension, not per-VS-Code-window, which means every VS Code window the user has open — each running its own Pip-Token extension host — writes to the same SQLite database file. `better-sqlite3`'s default `DELETE` journal mode serialises writers and returns `SQLITE_BUSY` if a second process tries to write while another holds the lock. In practice that means: two VS Code windows both receiving Claude Code turns, one window erroring on every insert, potentially crashing the extension host or silently dropping writes. A user running multiple VS Code windows with concurrent projects is the most likely to hit this bug on day one of dogfooding.

**Decision.** Three layered measures applied on every database connection open:

1. **WAL mode.** `db.pragma('journal_mode = WAL')`. Write-ahead logging allows one writer plus unlimited concurrent readers without blocking. Standard practice for multi-process SQLite access.
2. **Busy timeout.** `db.pragma('busy_timeout = 5000')`. If two writers do contend for the same row, the second waits up to 5000ms for the first to finish rather than erroring immediately. Covers the race window without user-visible symptoms.
3. **Atomic counter updates.** Counter columns are updated via SQL expressions, not application-layer read-modify-write: `UPDATE windows SET peak_input_tokens = peak_input_tokens + ? WHERE window_id = ?`. SQLite handles row-level increments atomically, so two windows both adding to the same counter both land their increments cleanly.

Documented in `/src/data/CLAUDE.md` as hard rules.

**Consequences.** Multi-window VS Code is safe by default. Pip-Token doesn't need any cross-process lock or message bus; SQLite handles the coordination. The performance cost is negligible — WAL is typically faster than `DELETE` mode anyway. The downside is that WAL creates a sidecar `-wal` file next to the main database, which users might see and be confused by; add a note to the README troubleshooting section. A second downside: if the extension is terminated mid-write, WAL's recovery is robust but `better-sqlite3` expects clean shutdowns; the `deactivate` hook must call `db.close()` explicitly.

**Alternatives considered.**
- Default `DELETE` mode + retry-on-busy wrapper (rejected — busy errors would still leak through under load, and retry loops are a source of subtle bugs)
- File lock external to SQLite (e.g. `proper-lockfile`) (rejected — reinvents what SQLite WAL already provides, adds a dependency, fails ungracefully on stuck locks)
- One database per VS Code window (rejected — breaks the whole point of account-wide aggregation; the status bar cannot answer "where do I stand against my account limits" if each window has its own view)
- Restrict Pip-Token to one VS Code window at a time (rejected — user-hostile, and detection is unreliable)
