# 0018 — SQLite concurrency: WAL mode, busy_timeout, atomic increments

**Status.** Accepted

**Date.** 2026-04-08

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
