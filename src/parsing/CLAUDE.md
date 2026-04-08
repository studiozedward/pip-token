# src/parsing/ — Parser Conventions

## Format warning

The Claude Code JSONL format is **undocumented** and may change between versions. Every assumption in this directory must be verified against real log files. See `docs/TOKEN_DATA_RESEARCH.md` for the investigation results.

## Defensive parsing

- Any unrecognised line is logged and skipped — never crashes
- Any unknown field is ignored — never fails on unexpected JSON keys
- Version detection: check for known field patterns to identify Claude Code version
- If the format changes, show LEARNING state in the UI, not an error

## Key conventions

- Sample fixtures live in `test/fixtures/sample-sessions/`
- Peak hour classification: timestamp → Pacific time → window check (uses `src/domain/peakHourSchedule.ts`)
- Active session tracking: 2-hour file mtime threshold, defined as a single constant in `activeSessionTracker.ts`
- Cache TTL: parse real `ephemeral_5m_input_tokens` and `ephemeral_1h_input_tokens` fields (see ADR 0019)
- Turn IDs are content-addressed: `sha256(session_id + "|" + timestamp + "|" + input_tokens + "|" + output_tokens)` — see ADR 0017
- File offset tracking in `watcher_state` table is a performance optimisation; correctness comes from idempotent turn IDs
- The watcher exposes `rescan()` to re-read all JSONL files. Combined with clearing `watcher_state`, this rebuilds all data from source logs (used by the RESYNC DATA action on the About page)
- Project name extraction uses `src/utils/projectName.ts` — a filesystem-probing decoder for Claude Code's lossy encoded directory names

## Rate limit detection

- Rate limit events are logged by Claude Code as assistant lines with `"error": "rate_limit"` and `"isApiErrorMessage": true` at the top level
- `parseLines()` returns a `ParseResult` with both `turns` and `rateLimitEvents`
- Dedup is required because rate limits are account-wide: every active session logs its own event. The watcher checks the most recent recorded limit hit and skips if within the plan-tier-specific dedup window (configured in `pricing.json` under `plan_tiers`)
