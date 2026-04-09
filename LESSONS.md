# Pip-Token — Lessons Learned

A running log of non-obvious things learned during the build. Newest at the top. See `docs/REPO_SETUP.md` for the format and when to add an entry.

## Window-based token totals break on resync when rate limits exist

**Date:** 2026-04-09
**Area:** `src/domain/liveStats.ts`, `src/webview/messageHandler.ts`

The "All Projects" view on LIVE/SESSION originally read token totals from the `windows` table (atomic counters incremented per turn). This works during normal operation, but breaks on resync: `resetAllData()` clears the window, then `rescan()` replays all JSONL files. If any rate limit events exist in the history, `handleRateLimitEvent()` closes the current window and opens a new one mid-replay. The final window only contains tokens accumulated after the last historical rate limit — not the full total.

**Fix:** Switched "All Projects" to compute from the `turns` table (same approach as filtered single-session views). Added `getTurnsForSessions()` to batch-query turns for all active session IDs. Window counters remain for other uses but are no longer the source of truth for display totals.

---

## Native select elements are unstyable in VS Code webviews

**Date:** 2026-04-09
**Area:** `src/webview/ui/components/projectSelector.ts`

The `<select>` dropdown menu is rendered by the OS, not the browser. Inside a VS Code webview this means the dropdown always appears with default system styling regardless of CSS. The closed state of the `<select>` can be styled but the open menu cannot. Replaced with a custom `.pip-select` component built from `<div>` elements for full Pip-Boy aesthetic control. Keyboard handling (Escape to close) and click-outside-to-close are manual.

---

## parseInt truncates float values stored in SVG data attributes

**Date:** 2026-04-09
**Area:** `src/webview/ui/components/barChart.ts`

Chart tooltip hit-areas store bar values in `data-*` attributes (e.g., `data-peak="12.53"`). The tooltip handler originally read these with `parseInt()`, which silently truncates to integers — cost chart values lost their decimal places. Always use `parseFloat()` when reading numeric data attributes that may contain decimals. `parseInt()` is only safe for values known to be integers (like limit hit counts).

---

## Rate limit events are logged in JSONL but not as API errors

**Date:** 2026-04-08
**Area:** `src/parsing/jsonlParser.ts`, `src/parsing/claudeCodeWatcher.ts`

Claude Code DOES log rate limit events to the session JSONL. They appear as assistant-type lines with `"error": "rate_limit"` and `"isApiErrorMessage": true` at the top level, and `model: "<synthetic>"` (not a real API response). The earlier assumption that 429s were handled internally and never logged was wrong — the initial search missed them because the sample logs predated any actual limit hits.

Critical dedup requirement: rate limits are account-wide, so every active session logs its own copy of the event. Stale sessions that resume during the same limit window also log one. Without dedup, a single limit hit with 5 active sessions would record 5 limit hits. The dedup window must be plan-tier-specific because Pro users can re-hit limits within minutes.

---

## sql.js wrapper persists the entire DB on every write

**Date:** 2026-04-08
**Area:** `src/data/db.ts`

The `sql.js` wrapper calls `db.export()` + `fs.writeFileSync()` after every `run()` and `exec()`. With thousands of turns during a resync, this is O(n^2) disk I/O. Fixed by adding `beginBatch()` / `endBatch()` to defer persistence. Any bulk operation (resync, initial scan) must wrap in a batch.

---

## Context utilisation undercounted when prompt caching is active

**Date:** 2026-04-08
**Area:** `src/domain/liveStats.ts`

With Anthropic's prompt caching, the API usage block splits input into three fields: `input_tokens` (non-cached), `cache_creation_input_tokens` (new cache writes), and `cache_read_input_tokens` (cache hits). The actual context window consumption is the sum of all three. Using only `input_tokens` massively undercounts context — in practice showing ~3% utilisation when the real figure is 20%+. This was already documented in `TOKEN_DATA_RESEARCH.md` but missed in the implementation.

**Fix:** `estContextUsed = input_tokens + cache_creation_input_tokens + cache_read_input_tokens`

---

## Claude Code encodes project paths lossily

**Date:** 2026-04-08
**Area:** `src/utils/projectName.ts`, `src/data/repositories/sessionRepo.ts`

Claude Code stores session files at `~/.claude/projects/<encoded-dir>/<session-uuid>.jsonl`. The encoded directory name replaces both `/` and ` ` with `-`, which is lossy (a real hyphen in a folder name becomes indistinguishable from a separator). Splitting on `-` and taking the last segment doesn't work — `pip-token` becomes just `token`. The fix is a greedy filesystem probe: walk the encoded string left-to-right, trying each `-` as a literal hyphen, directory separator, or space, and checking `fs.existsSync()` at each step.

---

## Settings saved to DB but never read back

**Date:** 2026-04-08
**Area:** `src/webview/messageHandler.ts`

All five page-builder functions called `getDefaultCurrency()` directly instead of `getSetting('currency') ?? getDefaultCurrency()`. The currency dropdown saved correctly to the database, but cost calculations always used the locale default. Any setting that gates a computation must be read from the DB at the point of use, not just at the point of display.

---

## Burn rate LEARNING vs STALE distinction

**Date:** 2026-04-08
**Area:** `src/domain/liveStats.ts`

A single `null` return for burn rate conflated two states: "not enough data yet" (new session) and "had data but it's stale" (session went idle). Users found this confusing. Changed to a tagged union: `number | 'LEARNING' | 'STALE'`. LEARNING = fewer than 2 turns. STALE = turns exist but none within the burn rate window.
