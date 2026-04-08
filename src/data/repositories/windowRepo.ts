import { getDb } from '../db';

export interface WindowRecord {
  window_id: number;
  started_at: string;
  ended_at: string | null;
  peak_input_tokens: number;
  peak_output_tokens: number;
  offpeak_input_tokens: number;
  offpeak_output_tokens: number;
  peak_cache_creation_tokens: number;
  peak_cache_read_tokens: number;
  offpeak_cache_creation_tokens: number;
  offpeak_cache_read_tokens: number;
  turn_count: number;
}

export function getCurrentWindow(): WindowRecord | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM windows WHERE ended_at IS NULL ORDER BY window_id DESC LIMIT 1').get() as WindowRecord | undefined;
}

/** Atomic counter increment — ADR 0018. Never read-modify-write. */
export function incrementWindowCounters(windowId: number, isPeak: boolean, inputTokens: number, outputTokens: number, cacheCreation: number, cacheRead: number): void {
  const db = getDb();
  if (isPeak) {
    db.prepare(`
      UPDATE windows SET
        peak_input_tokens = peak_input_tokens + ?,
        peak_output_tokens = peak_output_tokens + ?,
        peak_cache_creation_tokens = peak_cache_creation_tokens + ?,
        peak_cache_read_tokens = peak_cache_read_tokens + ?,
        turn_count = turn_count + 1
      WHERE window_id = ?
    `).run(inputTokens, outputTokens, cacheCreation, cacheRead, windowId);
  } else {
    db.prepare(`
      UPDATE windows SET
        offpeak_input_tokens = offpeak_input_tokens + ?,
        offpeak_output_tokens = offpeak_output_tokens + ?,
        offpeak_cache_creation_tokens = offpeak_cache_creation_tokens + ?,
        offpeak_cache_read_tokens = offpeak_cache_read_tokens + ?,
        turn_count = turn_count + 1
      WHERE window_id = ?
    `).run(inputTokens, outputTokens, cacheCreation, cacheRead, windowId);
  }
}

export function closeWindow(windowId: number): void {
  const db = getDb();
  db.prepare("UPDATE windows SET ended_at = datetime('now') WHERE window_id = ?").run(windowId);
}

export function openNewWindow(): number {
  const db = getDb();
  const result = db.prepare("INSERT INTO windows (started_at) VALUES (datetime('now'))").run();
  return Number(result.lastInsertRowid);
}
