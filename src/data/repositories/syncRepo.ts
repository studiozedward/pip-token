import { getDb } from '../db';

export interface SyncRecord {
  id: number;
  timestamp: string;
  fivehour_pct: number;
  weekly_pct: number;
  code_tokens_at_sync: number;
  inferred_other: number;
  plan_tier_at_sync: string | null;
}

export function insertSync(sync: Omit<SyncRecord, 'id'>): number {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO dashboard_syncs (timestamp, fivehour_pct, weekly_pct, code_tokens_at_sync, inferred_other, plan_tier_at_sync)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(sync.timestamp, sync.fivehour_pct, sync.weekly_pct,
    sync.code_tokens_at_sync, sync.inferred_other, sync.plan_tier_at_sync);
  return Number(result.lastInsertRowid);
}

export function getMostRecentSync(): SyncRecord | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM dashboard_syncs ORDER BY timestamp DESC LIMIT 1').get() as SyncRecord | undefined;
}
