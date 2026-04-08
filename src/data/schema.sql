-- Pip-Token SQLite schema v1
-- See docs/decisions/0017 (idempotent turns) and 0018 (concurrency)

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO schema_version (version) VALUES (1);

-- Individual parsed turns from Claude Code JSONL
CREATE TABLE IF NOT EXISTS turns (
  turn_id TEXT PRIMARY KEY,           -- sha256(sessionId|timestamp|input_tokens|output_tokens)
  session_id TEXT NOT NULL,
  request_id TEXT,
  timestamp TEXT NOT NULL,            -- ISO 8601 UTC
  model TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_input_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_input_tokens INTEGER NOT NULL DEFAULT 0,
  cache_5m_tokens INTEGER NOT NULL DEFAULT 0,
  cache_1h_tokens INTEGER NOT NULL DEFAULT 0,
  is_peak INTEGER NOT NULL DEFAULT 0, -- 0 = off-peak, 1 = peak
  stop_reason TEXT,                    -- 'end_turn', 'tool_use'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_turns_session ON turns(session_id);
CREATE INDEX IF NOT EXISTS idx_turns_timestamp ON turns(timestamp);

-- 5-hour usage windows (resets on limit hit)
CREATE TABLE IF NOT EXISTS windows (
  window_id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  ended_at TEXT,                       -- NULL if current window
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

-- Limit hit events
CREATE TABLE IF NOT EXISTS limit_hits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  window_id INTEGER REFERENCES windows(window_id),
  detection_method TEXT NOT NULL,       -- 'explicit_429', 'timing_gap', 'manual'
  peak_input_tokens INTEGER NOT NULL DEFAULT 0,
  peak_output_tokens INTEGER NOT NULL DEFAULT 0,
  offpeak_input_tokens INTEGER NOT NULL DEFAULT 0,
  offpeak_output_tokens INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

-- Known Claude Code sessions
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  project_path TEXT,
  project_name TEXT,
  first_seen_at TEXT NOT NULL,
  last_activity_at TEXT NOT NULL,
  total_turns INTEGER NOT NULL DEFAULT 0
);

-- Dashboard sync records (manual calibration)
CREATE TABLE IF NOT EXISTS dashboard_syncs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  fivehour_pct REAL NOT NULL,
  weekly_pct REAL NOT NULL,
  code_tokens_at_sync INTEGER NOT NULL,
  inferred_other INTEGER NOT NULL DEFAULT 0,
  plan_tier_at_sync TEXT
);

-- Singleton settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- File watcher offset tracking (performance optimisation)
CREATE TABLE IF NOT EXISTS watcher_state (
  file_path TEXT PRIMARY KEY,
  byte_offset INTEGER NOT NULL DEFAULT 0,
  last_read_at TEXT NOT NULL DEFAULT (datetime('now'))
);
