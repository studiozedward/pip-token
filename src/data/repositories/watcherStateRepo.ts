import { getDb } from '../db';

export interface WatcherState {
  file_path: string;
  byte_offset: number;
  last_read_at: string;
}

export function getWatcherState(filePath: string): WatcherState | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM watcher_state WHERE file_path = ?').get(filePath) as WatcherState | undefined;
}

export function setWatcherState(filePath: string, byteOffset: number): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO watcher_state (file_path, byte_offset, last_read_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(file_path) DO UPDATE SET
      byte_offset = ?,
      last_read_at = datetime('now')
  `).run(filePath, byteOffset, byteOffset);
}
