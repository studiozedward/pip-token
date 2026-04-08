# Pip-Token — Lessons Learned

A running log of non-obvious things learned during the build. Newest at the top. See `docs/REPO_SETUP.md` for the format and when to add an entry.

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
