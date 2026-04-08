# src/data/ — Storage Conventions

## SQLite via better-sqlite3

- Synchronous API — no async/await ceremony for trivial reads
- Database lives in `context.globalStorageUri` per VS Code convention

## Concurrency (hard rules)

On every connection open:

1. `PRAGMA journal_mode = WAL` — allows one writer + multiple readers
2. `PRAGMA busy_timeout = 5000` — waits instead of erroring on contention

See ADR 0018.

## Atomic counter updates (hard rule)

Never read-modify-write counter columns. Always use SQL expressions:

```sql
UPDATE windows SET peak_input_tokens = peak_input_tokens + ? WHERE window_id = ?
```

The application layer must not hold a counter value in memory and write it back. Two VS Code windows racing on the same row must both succeed.

## Idempotent writes

Turn inserts use `INSERT OR IGNORE` because `turn_id` is content-addressed. See ADR 0017 and DESIGN §7.

## Schema

- Schema migrations are numbered SQL files
- Schema version tracked in a `schema_version` table
- Append-only writes everywhere except settings (singleton) and current window counters

## Access pattern

Repositories are the only path to the database. Pages never query directly.
