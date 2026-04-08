import { getDb } from '../db';
import { extractProjectName } from '../../utils/projectName';

export interface SessionRecord {
  session_id: string;
  project_path: string | null;
  project_name: string | null;
  first_seen_at: string;
  last_activity_at: string;
  total_turns: number;
}

export function upsertSession(sessionId: string, projectPath: string | null, timestamp: string): void {
  const db = getDb();
  const projectName = projectPath ? extractProjectName(projectPath) : null;

  db.prepare(`
    INSERT INTO sessions (session_id, project_path, project_name, first_seen_at, last_activity_at, total_turns)
    VALUES (?, ?, ?, ?, ?, 1)
    ON CONFLICT(session_id) DO UPDATE SET
      last_activity_at = ?,
      project_name = ?,
      total_turns = total_turns + 1
  `).run(sessionId, projectPath, projectName, timestamp, timestamp, timestamp, projectName);
}

export function getActiveSessions(since: string): SessionRecord[] {
  const db = getDb();
  return db.prepare('SELECT * FROM sessions WHERE last_activity_at >= ? ORDER BY last_activity_at DESC').all(since) as unknown as SessionRecord[];
}

export function getAllSessions(): SessionRecord[] {
  const db = getDb();
  return db.prepare('SELECT * FROM sessions ORDER BY last_activity_at DESC').all() as unknown as SessionRecord[];
}
