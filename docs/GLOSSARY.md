# Pip-Token — Glossary

## Sessions and projects

### Active session
A Claude Code session whose JSONL file has been modified within the last **2 hours**. Used to populate the project selector on relevant pages. The 2-hour threshold catches normal interruptions (lunch, meetings, context switches) without showing stale work from the previous day.

A session that goes silent for >2 hours drops out of the active list automatically. If activity resumes, it reappears.

### Project
The folder Claude Code was launched from. Pip-Token identifies projects by either the Git repository name (if the folder is a Git repo) or the folder name otherwise. Multiple sessions can belong to the same project if Claude Code was opened in that folder more than once.

### Active sessions list
The set of all currently-active sessions across all projects, used to populate the project selector. Ordered by most recently active first. Each entry shows the project name and a relative "last activity" time (e.g. "12 min ago", "1h 47m ago").

### Aggregated view (default)
Pip-Token's default view across all active sessions. All counters and projections sum across every active session. This is the only honest view for limit-related metrics because Anthropic's 5-hour and weekly limits are account-wide, not per-session — every concurrent Claude Code instance eats from the same shared budget.

**Exception: per-session metrics.** Some metrics are fundamentally per-session and cannot be aggregated. Context window fill and cache state are the main examples — each session has its own context window and its own prompt cache, and "average context across 3 sessions" or "combined cache state" would be misleading. Pages that show per-session metrics (LIVE/CONTEXT and LIVE/CACHE) hide the `[ALL PROJECTS]` option from the project selector entirely and default to the most recently active session.

### Per-project view (filtered)
A drill-down view that filters all metrics to a single selected project. Useful for "how is *this* project going" questions. Selected via the project picker at the top of the LIVE pages. The picker reads `[ALL PROJECTS ▾]` by default on aggregatable pages and switches to `[PROJECT-NAME ▾]` when filtered. On per-session pages, the picker defaults directly to a project name with no `[ALL PROJECTS]` option. The status bar always shows aggregated data regardless of the picker — its job is to answer "where do I stand against my account limits."

---

## Time and scheduling

### Peak hours
Weekdays (Monday–Friday) from **5:00 AM to up to (but not including) 11:00 AM Pacific Time** (i.e. 5:00–10:59 AM). The UK/EU equivalent shifts by an hour twice a year at DST transitions, so the docs deliberately don't hardcode a GMT/BST conversion — `src/domain/peakHourSchedule.ts` always computes it live from the current Pacific time rules. During peak hours, Anthropic burns through Free / Pro / Max session limits faster than wall-clock time would suggest. The exact multiplier is undocumented and changes silently.

This definition is hardcoded in `src/domain/peakHourSchedule.ts` so a single edit propagates everywhere. If Anthropic changes the window, only that file needs updating.

### Off-peak hours
Any time outside the peak window, including all weekend hours.

### 5-hour session window
Anthropic's rolling rate limit window. Resets 5 hours after first activity. Shared across all Claude Code sessions on the account. Token cost against this window is heavier during peak hours.

### Weekly window
Anthropic's longer-term rate limit. Aggregated weekly. Less frequently hit but harder to recover from.

### Active day
A calendar day with at least one Claude Code turn recorded. Used for "average per active day" calculations on STATS and HISTORY pages — days with zero Claude Code activity are excluded from the denominator. This avoids dragging averages down on weekends or holidays when the user wasn't working at all.

The day boundary is computed in the user's local timezone (auto-detected via `Intl.DateTimeFormat().resolvedOptions().timeZone`), with an override available in ABOUT for users who want to pin to a different timezone.

### Average per active day
A metric calculation where the total is divided by the number of active days in the relevant window, not the total number of calendar days in the window. Examples:
- A week with activity on 3 days and 90k total tokens has an average per active day of 30k, not ~13k.
- A month with activity on 12 days and 600k total tokens has an average per active day of 50k, not ~20k.

Used by HISTORY/MONTH (avg per week), HISTORY/QUARTER (avg per month), HISTORY/YEAR (avg per month), and the AVG/DAY card on STATS pages. The TOTAL card on each page still shows the raw sum — only averages are active-day-adjusted.

### Week periods (three distinct conventions)
Pip-Token intentionally uses three different "week" concepts in different places. They look similar but mean different things; don't conflate them:

- **Rolling 7 days.** The last 168 hours from now, regardless of calendar. Used by the status bar `WK` cost segment and the STATS pages (TOKENS, COST). Answers "what has my recent behaviour looked like?" Never resets.
- **Calendar week (Mon–Sun).** A fixed Monday-to-Sunday block. Used by HISTORY/WEEK for navigating through past weeks with the period arrows.

The two concepts are deliberate: status bar + STATS = "recent trend," HISTORY = "archive". If a new page ever wants a "week" value, pick one of these two — don't invent a third.

---

## Tokens and counters

### Input tokens
Tokens sent TO Claude in a turn — system prompt, conversation history, file contents, tool definitions. Drives most of the token cost in Claude Code workflows because large codebases get re-read each turn.

### Output tokens
Tokens generated BY Claude in a turn — the assistant's response, including any tool calls.

### Peak tokens
The sum of (input + output) tokens for all turns whose timestamp falls within the peak window. Tracked separately from off-peak tokens so the user's own limit-hit history can reveal the relationship between peak and off-peak burn rates without Pip-Token having to invent a multiplier.

**Boundary-straddling turns.** A turn is classified entirely by its recorded timestamp (the assistant-response time written by Claude Code), not by how long it took to generate. A turn that starts at 10:58 Pacific and finishes at 11:02 Pacific lands in whichever bucket its logged timestamp falls into — typically off-peak in that example, since the response time is after 11:00. Pip-Token does not attempt to split turns across buckets, because token counts are per-turn not per-second and pro-rating would add more error than it removes. This convention is documented in DESIGN §7.

### Off-peak tokens
The sum of (input + output) tokens for all turns whose timestamp falls outside the peak window.

### Cache creation tokens
Input tokens that wrote new content to the prompt cache. Charged at full input price.

### Cache read tokens
Input tokens that were served from the prompt cache. Charged at approximately 10% of normal input price for the default 5-minute cache, or 50% for the 1-hour cache.

### Saved tokens
Estimated tokens the user did not have to pay full price for, thanks to cache hits. Calculated as `cache_read_tokens × (1 - cache_discount)`.

**v1 caveat.** Pip-Token assumes the 5-minute cache TTL is in effect (`cache_discount = 0.9`, meaning cache reads cost 10% of full price). If Claude Code is using the 1-hour cache, the discount is actually 0.5 and Pip-Token's saved-tokens figure will overstate savings by ~5x. Detecting which TTL is active requires reading a field that may not exist in the JSONL — see Q2 in TOKEN_DATA_RESEARCH.md. This is a known limitation flagged in ABOUT.

---

## Rates and projections

### Burn rate
Tokens consumed per minute, calculated over the **rolling last 5 minutes**. Smooths short spikes without lagging real changes. Requires at least 2 turns with 1+ minute between them before showing a value; until then, burn rate shows the LEARNING state.

### Estimated time to limit
A projection of how long until the user hits their 5-hour session limit, based on:
- Current peak and off-peak token counts in the active 5-hour window
- The user's personal historical limit-hit thresholds (median peak / off-peak tokens at the moment of past limit hits)
- The current burn rate

Displayed with a tilde prefix (`~3H 14M`) when based on 1–4 historical limit hits to signal noise. Drops the tilde once the user has 5+ historical hits and the projection stabilises.

When the user has zero historical limit hits, this metric shows the LEARNING state.

### LEARNING state
A placeholder string shown in place of a metric value when Pip-Token doesn't yet have enough data to compute it honestly. Canonical variants:
- `LEARNING` for time-based warmups (e.g. burn rate — needs 2+ turns with at least 1 minute between them)
- `LEARNING — NEEDS LIMIT HIT` for projections that require at least one historical limit hit
- `LEARNING — NEEDS SYNC` for the OTHER source bucket before the user has ever performed a dashboard sync

Used universally across the UI rather than showing zeros, dashes, or fake projections. The ABOUT page explains what each LEARNING state is waiting for.

### Insufficient data
A different placeholder reserved for cases where the data **may not be available at all**, not just "we're still warming up." Used for things like context decomposition that might not be exposed by Claude Code's logs. Distinct from LEARNING because LEARNING resolves with time, INSUFFICIENT DATA may never resolve.

---

## Limits and detection

### Limit hit event
A recorded event where the user's Claude Code session was blocked by an Anthropic rate limit response (HTTP 429). Each event captures the timestamp, the peak and off-peak token counts in the current window at the moment of the hit, the limit type (5-hour session vs weekly), and the detection method.

### Detection methods
- **API_ERROR** — explicit 429 response found in the session JSONL. Highest confidence.
- **MANUAL_LOG** — user clicked "I just hit a limit" in the UI or ran the `Pip-Token: Log Limit Hit` command. High confidence (the user knows). **v1 logs the hit at the current timestamp only**; backdating a hit to an earlier time is a v2 feature requiring a date/time picker.
- **INFERRED** — a 5+ minute gap immediately after a suspicious error pattern. Lower confidence, flagged in the UI.

### Personal threshold
The user's median peak / off-peak token counts at the moment of past limit hits. Used to compute EST. TIME TO LIMIT. Becomes meaningful after ~3 hits. Replaces the cold-start placeholder thresholds derived from plan tier once enough real data exists.

### Cold-start placeholder thresholds
Rough public estimates seeded based on the user's selected plan tier (Free / Pro / Max 5x / Max 20x) during onboarding. Used only until the user accumulates real personal threshold data. Clearly labelled as estimates in the UI.

---

## Source buckets and dashboard sync

### Source bucket
A categorisation of where token usage came from. Pip-Token tracks two source buckets in v1:

- **`CODE`** — tokens parsed directly from Claude Code's local session logs. Measured precisely.
- **`OTHER`** — tokens inferred from dashboard sync events. Includes Claude.ai web chat, mobile app usage, direct Anthropic API calls from other tools, and anything else that consumed limit budget but isn't visible to Pip-Token's parser.

Until the user performs a dashboard sync, the `OTHER` bucket is empty and Pip-Token shows only `CODE` data. A small persistent hint on LIVE pages reads "OTHER usage not synced — projections may be optimistic" so the user understands what's missing.

A possible future third bucket — **`CHAT`** — would come from a browser extension companion that intercepts Claude.ai API calls directly. Out of scope for v1.

### Dashboard sync
A manual workflow where the user opens Anthropic's Settings → Usage page, reads the current 5-hour and weekly percentages shown there, and enters them into Pip-Token via the SYNC button in ABOUT.

The sync acts as a calibration point. Pip-Token compares the dashboard percentages against its own locally-tracked Claude Code tokens at the moment of sync, computes the delta, and attributes it to the OTHER bucket. Each sync improves the accuracy of EST. TIME TO LIMIT for users who split work across Claude Code and other Claude clients.

Each sync is stored as a timestamped record:

```
sync_id              UUID
timestamp            timestamp
fivehour_pct         decimal (e.g. 47.0)
weekly_pct           decimal (e.g. 23.0)
code_tokens_at_sync  int (Pip-Token's own counter at sync time)
inferred_other       int (computed delta attributed to OTHER bucket)
```

Dashboard syncs are entirely user-initiated. Pip-Token does not call any Anthropic API to fetch this data. The system treats syncs as ground truth for the moment they were captured and decays their authority over time — a sync from 2 hours ago is more trustworthy than one from 2 days ago.

### Sync staleness
The age of the most recent dashboard sync. Pip-Token displays this in two places:
- Next to the OTHER bucket value: `OTHER 47K (synced 2h ago)`
- As a recommendation banner if no sync in the last 24 hours: "Sync with dashboard for accurate projections"

Users who sync frequently get more accurate `EST. TIME TO LIMIT` projections. Users who never sync still get useful CODE-only data, just with the caveat above.

---

## Cache state

### Cache state
The current status of the user's prompt cache. One of:
- **FRESH** — cache is active and would be reused on the next turn
- **EXPIRING** — cache is within the last 30 seconds of its TTL
- **EXPIRED** — cache has timed out and the next turn will re-read context at full price

### Cache TTL
Time-to-live of the prompt cache. Either 5 minutes (default) or 1 hour (extended). Pip-Token cannot toggle this — Claude Code controls which TTL is used per API call.

**v1 assumption.** Pip-Token assumes the 5-minute cache is in effect for all calculations. The CACHE TYPE row is not shown to users in v1 because reading the active TTL from JSONL is unreliable (see Q2 in TOKEN_DATA_RESEARCH.md). If the user is actually on a 1-hour cache, Pip-Token's cache state and savings figures will be wrong — the ABOUT page notes this limitation. Detection of the active TTL is a v2 feature.

### Cache hit
A turn where `cache_read_tokens > 0`, meaning at least some context was served from the cache.

### Cache miss
A turn where `cache_read_tokens == 0` and `cache_creation_tokens > 0`, meaning the cache had to be (re)built.

---

## Cost

### Estimated API-equivalent cost
The cost the user would pay if they were on the pay-as-you-go API rather than a subscription. Calculated by mapping tokens to current Anthropic API pricing per model and converting to the user's selected currency. **Always labelled as estimated and API-equivalent** to avoid confusing subscription users into thinking they are being charged per token.

### Pricing source
A single JSON file at `src/domain/pricing.json` containing per-model input and output token prices, the date the snapshot was taken, the source URL on Anthropic's docs, and a fixed currency exchange rate snapshot. **All cost calculations across the extension read from this one file.** When Anthropic changes prices, the maintainer edits this file once and the change propagates everywhere. The build should pull current pricing from public docs when first creating this file.

### Currency
The user's selected display currency. Auto-detected from system locale on first run, overridable in ABOUT. Conversion uses a fixed exchange rate snapshot — live FX is out of scope for v1.

---

## UI conventions

### Selected stat
The currently highlighted stat row or stat card on a page. Inverted colours (bright green background, dark text). Clicking a stat selects it and updates the description text in the mascot panel.

### Advisory
A short, single-sentence prompt shown in the dashed advisory box on a page. Generated by the advisory engine from the actual data on screen, not generic. Only the highest-priority matching advisory is shown per page. If no rules match, no advisory appears.

### Mascot description
The text below the page's mascot that explains the currently selected stat or provides page-level context. Updates when the user clicks a different stat.

### Tilde prefix
The `~` character before a number indicates an estimated value with meaningful uncertainty. Used for projections based on small data samples and any other estimate the user should treat as approximate rather than exact.

### Period navigation
The arrow controls on HISTORY pages that let the user move backwards and forwards through time. Each HISTORY sub-page has its own period — week, month, quarter, year — and the arrows step through one period at a time.

The current period title sits between two arrows: `[◄] APRIL 2026 [►]`. The forward arrow is dimmed when on the current period (you can't navigate into the future). To return to the current period after wandering backwards, the user clicks the forward arrow until they arrive — there's no dedicated "today" button in v1 (deferred to v2).

Charts and stat cards always reflect the currently selected period. The status bar always reflects current real-time data regardless of where the user has navigated.
