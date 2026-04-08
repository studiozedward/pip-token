import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase, BindParams } from 'sql.js';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Compatibility wrapper — exposes a better-sqlite3-shaped API on top of sql.js
// so that all repository files work without changes.
// ---------------------------------------------------------------------------

interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

interface PreparedLike {
  run(...params: unknown[]): RunResult;
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
}

export interface DatabaseLike {
  prepare(sql: string): PreparedLike;
  exec(sql: string): void;
}

class SqlJsPrepared implements PreparedLike {
  constructor(private db: SqlJsDatabase, private sql: string, private save: () => void) {}

  run(...params: unknown[]): RunResult {
    this.db.run(this.sql, params as BindParams);
    const changes = this.db.getRowsModified();
    const idResult = this.db.exec('SELECT last_insert_rowid()');
    const lastInsertRowid = idResult.length > 0 ? (idResult[0].values[0][0] as number) : 0;
    this.save();
    return { changes, lastInsertRowid };
  }

  get(...params: unknown[]): Record<string, unknown> | undefined {
    const stmt = this.db.prepare(this.sql);
    try {
      if (params.length > 0) {
        stmt.bind(params as BindParams);
      }
      if (stmt.step()) {
        return stmt.getAsObject() as Record<string, unknown>;
      }
      return undefined;
    } finally {
      stmt.free();
    }
  }

  all(...params: unknown[]): Record<string, unknown>[] {
    const stmt = this.db.prepare(this.sql);
    try {
      if (params.length > 0) {
        stmt.bind(params as BindParams);
      }
      const rows: Record<string, unknown>[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as Record<string, unknown>);
      }
      return rows;
    } finally {
      stmt.free();
    }
  }
}

class SqlJsWrapper implements DatabaseLike {
  constructor(private db: SqlJsDatabase, private dbPath: string) {}

  prepare(sql: string): PreparedLike {
    return new SqlJsPrepared(this.db, sql, () => this.persist());
  }

  exec(sql: string): void {
    this.db.exec(sql);
    this.persist();
  }

  /** Write the in-memory database to disk. */
  persist(): void {
    try {
      const data = this.db.export();
      fs.writeFileSync(this.dbPath, Buffer.from(data));
    } catch (err) {
      logger.error('Failed to persist database', err);
    }
  }

  close(): void {
    this.persist();
    this.db.close();
  }

  getRaw(): SqlJsDatabase {
    return this.db;
  }
}

// ---------------------------------------------------------------------------
// Module-level singleton
// ---------------------------------------------------------------------------

let wrapper: SqlJsWrapper | null = null;

export function getDb(): DatabaseLike {
  if (!wrapper) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return wrapper;
}

export async function initDb(context: vscode.ExtensionContext): Promise<DatabaseLike> {
  const storagePath = context.globalStorageUri.fsPath;
  fs.mkdirSync(storagePath, { recursive: true });

  const dbPath = path.join(storagePath, 'pip-token.db');
  logger.info(`Opening database at ${dbPath}`);

  // Locate the WASM file bundled alongside the extension JS
  const wasmPath = path.join(context.extensionUri.fsPath, 'out', 'sql-wasm.wasm');

  const SQL = await initSqlJs({
    locateFile: () => wasmPath,
  });

  // Load existing database from disk, or create a new one
  let db: SqlJsDatabase;
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    logger.info('Loaded existing database from disk');
  } else {
    db = new SQL.Database();
    logger.info('Created new database');
  }

  wrapper = new SqlJsWrapper(db, dbPath);

  // Schema is bundled inline since esbuild won't include .sql files
  runSchema(wrapper);

  logger.info('Database initialized');
  return wrapper;
}

function runSchema(w: SqlJsWrapper): void {
  // Use the raw sql.js db for multi-statement exec
  w.getRaw().exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO schema_version (version) VALUES (1);

    CREATE TABLE IF NOT EXISTS turns (
      turn_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      request_id TEXT,
      timestamp TEXT NOT NULL,
      model TEXT,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_creation_input_tokens INTEGER NOT NULL DEFAULT 0,
      cache_read_input_tokens INTEGER NOT NULL DEFAULT 0,
      cache_5m_tokens INTEGER NOT NULL DEFAULT 0,
      cache_1h_tokens INTEGER NOT NULL DEFAULT 0,
      is_peak INTEGER NOT NULL DEFAULT 0,
      stop_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_turns_session ON turns(session_id);
    CREATE INDEX IF NOT EXISTS idx_turns_timestamp ON turns(timestamp);

    CREATE TABLE IF NOT EXISTS windows (
      window_id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      peak_input_tokens INTEGER NOT NULL DEFAULT 0,
      peak_output_tokens INTEGER NOT NULL DEFAULT 0,
      offpeak_input_tokens INTEGER NOT NULL DEFAULT 0,
      offpeak_output_tokens INTEGER NOT NULL DEFAULT 0,
      peak_cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
      peak_cache_read_tokens INTEGER NOT NULL DEFAULT 0,
      offpeak_cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
      offpeak_cache_read_tokens INTEGER NOT NULL DEFAULT 0,
      turn_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS limit_hits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      window_id INTEGER REFERENCES windows(window_id),
      detection_method TEXT NOT NULL,
      peak_input_tokens INTEGER NOT NULL DEFAULT 0,
      peak_output_tokens INTEGER NOT NULL DEFAULT 0,
      offpeak_input_tokens INTEGER NOT NULL DEFAULT 0,
      offpeak_output_tokens INTEGER NOT NULL DEFAULT 0,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      project_path TEXT,
      project_name TEXT,
      first_seen_at TEXT NOT NULL,
      last_activity_at TEXT NOT NULL,
      total_turns INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS dashboard_syncs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      fivehour_pct REAL NOT NULL,
      weekly_pct REAL NOT NULL,
      code_tokens_at_sync INTEGER NOT NULL,
      inferred_other INTEGER NOT NULL DEFAULT 0,
      plan_tier_at_sync TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS watcher_state (
      file_path TEXT PRIMARY KEY,
      byte_offset INTEGER NOT NULL DEFAULT 0,
      last_read_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Create initial window if none exists
  const windowCount = w.prepare('SELECT COUNT(*) as count FROM windows').get() as { count: number } | undefined;
  if (!windowCount || windowCount.count === 0) {
    w.prepare("INSERT INTO windows (started_at) VALUES (datetime('now'))").run();
  }

  // Persist after schema setup
  w.persist();
}

/**
 * Wipe all data tables but keep schema_version and settings.
 * Re-creates an initial window so the extension can continue operating.
 */
export function resetAllData(): void {
  if (!wrapper) throw new Error('Database not initialized');
  wrapper.getRaw().exec(`
    DELETE FROM turns;
    DELETE FROM windows;
    DELETE FROM limit_hits;
    DELETE FROM sessions;
    DELETE FROM dashboard_syncs;
    DELETE FROM watcher_state;
  `);
  wrapper.prepare("INSERT INTO windows (started_at) VALUES (datetime('now'))").run();
  logger.info('All data tables reset');
}

export function closeDb(): void {
  if (wrapper) {
    logger.info('Closing database');
    wrapper.close();
    wrapper = null;
  }
}
