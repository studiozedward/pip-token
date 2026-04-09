import { getDb } from '../db';
import * as crypto from 'crypto';

export interface TurnRecord {
  turn_id: string;
  session_id: string;
  request_id: string | null;
  timestamp: string;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  cache_5m_tokens: number;
  cache_1h_tokens: number;
  is_peak: number;
  stop_reason: string | null;
}

export function generateTurnId(sessionId: string, timestamp: string, inputTokens: number, outputTokens: number): string {
  const content = `${sessionId}|${timestamp}|${inputTokens}|${outputTokens}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function insertTurn(turn: TurnRecord): boolean {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO turns
    (turn_id, session_id, request_id, timestamp, model, input_tokens, output_tokens,
     cache_creation_input_tokens, cache_read_input_tokens, cache_5m_tokens, cache_1h_tokens,
     is_peak, stop_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    turn.turn_id, turn.session_id, turn.request_id, turn.timestamp,
    turn.model, turn.input_tokens, turn.output_tokens,
    turn.cache_creation_input_tokens, turn.cache_read_input_tokens,
    turn.cache_5m_tokens, turn.cache_1h_tokens,
    turn.is_peak, turn.stop_reason
  );
  return result.changes > 0;
}

export function getSessionTurns(sessionId: string): TurnRecord[] {
  const db = getDb();
  return db.prepare('SELECT * FROM turns WHERE session_id = ? ORDER BY timestamp ASC').all(sessionId) as unknown as TurnRecord[];
}

export function getRecentTurns(since: string): TurnRecord[] {
  const db = getDb();
  return db.prepare('SELECT * FROM turns WHERE timestamp >= ? ORDER BY timestamp ASC').all(since) as unknown as TurnRecord[];
}

export function getLastTurnForSession(sessionId: string): TurnRecord | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM turns WHERE session_id = ? ORDER BY timestamp DESC LIMIT 1').get(sessionId) as TurnRecord | undefined;
}

export function getLastTurn(): TurnRecord | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM turns ORDER BY timestamp DESC LIMIT 1').get() as TurnRecord | undefined;
}

export function getSessionTurnsSince(sessionId: string, since: string): TurnRecord[] {
  const db = getDb();
  return db.prepare('SELECT * FROM turns WHERE session_id = ? AND timestamp >= ? ORDER BY timestamp ASC').all(sessionId, since) as unknown as TurnRecord[];
}

export function getTurnsForSessionToday(sessionId: string, todayStart: string): TurnRecord[] {
  const db = getDb();
  return db.prepare('SELECT * FROM turns WHERE session_id = ? AND timestamp >= ? ORDER BY timestamp ASC').all(sessionId, todayStart) as unknown as TurnRecord[];
}

export function getTurnsBetween(start: string, end: string): TurnRecord[] {
  const db = getDb();
  return db.prepare('SELECT * FROM turns WHERE timestamp >= ? AND timestamp < ? ORDER BY timestamp ASC').all(start, end) as unknown as TurnRecord[];
}

export function getTurnsForSessions(sessionIds: string[]): TurnRecord[] {
  if (sessionIds.length === 0) return [];
  const db = getDb();
  const placeholders = sessionIds.map(() => '?').join(', ');
  return db.prepare(
    `SELECT * FROM turns WHERE session_id IN (${placeholders}) ORDER BY timestamp ASC`
  ).all(...sessionIds) as unknown as TurnRecord[];
}

export function getTurnCount(): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM turns').get() as { count: number };
  return row.count;
}
