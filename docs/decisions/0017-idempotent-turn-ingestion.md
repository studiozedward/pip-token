# 0017 — Idempotent turn ingestion via content-addressed IDs

**Status.** Accepted

**Date.** 2026-04-08

**Context.** Claude Code's session JSONL files are append-only logs that Pip-Token reads with a file watcher. Two scenarios force the parser to re-read lines it has already processed: (a) VS Code restarts, which reset the watcher's in-memory offset tracking, and (b) any future maintenance that wipes the `watcher_state` offset cache. If each re-read produces a fresh random UUID for the turn, the database happily inserts a second row for the same turn and counters double. Restart VS Code three times during a heavy day and your token counts appear three times higher than reality, with no way to detect or recover from the drift.

**Decision.** Turn IDs are not random UUIDs. They are derived from the turn's own contents: `turn_id = sha256(session_id + "|" + timestamp + "|" + input_tokens + "|" + output_tokens)`, stored as the primary key of the `turns` table. Writes use `INSERT OR IGNORE INTO turns` so duplicate inserts are silently absorbed. The same turn, re-read any number of times, always produces the same ID and never double-counts.

A separate `watcher_state` table tracks file offsets so restarts resume from the right byte position rather than re-reading whole files. This is a performance optimisation on top of the idempotent IDs — if the offset cache is corrupted or wiped, correctness is still guaranteed by the ID scheme.

**Consequences.** Pip-Token's counters stay honest across restarts, file watcher hiccups, parser re-runs on fixture files, and any future "reprocess historical data" features. The hash is deterministic and cheap. The downside is that if Claude Code ever logs two genuinely distinct turns with identical `session_id + timestamp + input_tokens + output_tokens` values (theoretically possible for back-to-back zero-output tool calls), one would be silently dropped — in practice this is vanishingly unlikely, and if it turns out to be a real problem, the hash input can be extended to include a finer-grained field like `model` or `cache_creation_input_tokens`.

**Alternatives considered.**
- Random UUIDs + file offset tracking alone (rejected — offset corruption silently double-counts, no recovery)
- Unique constraint on `(session_id, timestamp, input_tokens, output_tokens)` with random UUIDs (rejected — functionally equivalent to content-addressed IDs but requires a separate composite index and is less obvious to future readers)
- "Mark the file parsed" flag on the sessions table (rejected — doesn't handle partial reads or mid-file re-entry)
- Delete and re-insert on every parse (rejected — destroys audit history and breaks any repository that joins on turn_id)
