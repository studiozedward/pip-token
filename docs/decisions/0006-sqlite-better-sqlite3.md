# 0006 — SQLite via better-sqlite3

**Status.** Accepted

**Date.** 2026-04-08

**Context.** Pip-Token needs persistent local storage for token counters, limit hit events, dashboard syncs, and settings. The choices are: a flat JSON file, a key-value store, or a relational database. Performance matters because the database is queried on every webview update.

**Decision.** SQLite via the `better-sqlite3` Node.js library. Single file stored in VS Code's `globalStorageUri` per-extension directory. All access goes through a thin repository layer.

**Consequences.** `better-sqlite3` provides a synchronous API, which simplifies the data access code (no async/await ceremony for trivial reads). SQL is well-known and maintenance-friendly. Schema migrations are straightforward via numbered SQL files. Memory footprint is small. The downside is that `better-sqlite3` is a native module and must be rebuilt for each Node version and platform — VS Code extensions handle this via the marketplace, but local development needs `npm rebuild` after Node updates.

**Alternatives considered.**
- Flat JSON file (rejected — doesn't scale to a year of historical data, no query language)
- LevelDB / lmdb (rejected — key-value stores require manual indexing for the queries we need)
- IndexedDB in the webview (rejected — webview storage doesn't survive extension reloads cleanly)
- A remote database (rejected — see ADR 0004, no backend)
