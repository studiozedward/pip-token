import { getDb } from '../db';

export interface LimitHitRecord {
  id: number;
  timestamp: string;
  window_id: number | null;
  detection_method: string;
  peak_input_tokens: number;
  peak_output_tokens: number;
  offpeak_input_tokens: number;
  offpeak_output_tokens: number;
  notes: string | null;
}

export function insertLimitHit(hit: Omit<LimitHitRecord, 'id'>): number {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO limit_hits (timestamp, window_id, detection_method,
      peak_input_tokens, peak_output_tokens, offpeak_input_tokens, offpeak_output_tokens, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(hit.timestamp, hit.window_id, hit.detection_method,
    hit.peak_input_tokens, hit.peak_output_tokens,
    hit.offpeak_input_tokens, hit.offpeak_output_tokens, hit.notes);
  return Number(result.lastInsertRowid);
}

export function getRecentLimitHits(limit: number = 10): LimitHitRecord[] {
  const db = getDb();
  return db.prepare('SELECT * FROM limit_hits ORDER BY timestamp DESC LIMIT ?').all(limit) as unknown as LimitHitRecord[];
}

export function getLimitHitCount(): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM limit_hits').get() as { count: number };
  return row.count;
}

export function getLimitHitsBetween(start: string, end: string): LimitHitRecord[] {
  const db = getDb();
  return db.prepare('SELECT * FROM limit_hits WHERE timestamp >= ? AND timestamp < ? ORDER BY timestamp ASC').all(start, end) as unknown as LimitHitRecord[];
}

export function getMedianLimitHitTokens(): { peakTokens: number; offpeakTokens: number } | null {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      (peak_input_tokens + peak_output_tokens) AS peak_total,
      (offpeak_input_tokens + offpeak_output_tokens) AS offpeak_total
    FROM limit_hits
    ORDER BY timestamp ASC
  `).all() as Array<{ peak_total: number; offpeak_total: number }>;

  if (rows.length === 0) {
    return null;
  }

  const peakValues = rows.map(r => r.peak_total).sort((a, b) => a - b);
  const offpeakValues = rows.map(r => r.offpeak_total).sort((a, b) => a - b);

  const median = (sorted: number[]): number => {
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return Math.floor((sorted[mid - 1] + sorted[mid]) / 2);
    }
    return sorted[mid];
  };

  return {
    peakTokens: median(peakValues),
    offpeakTokens: median(offpeakValues),
  };
}
