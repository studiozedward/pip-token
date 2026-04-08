import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

export interface ActiveSession {
  sessionId: string;
  projectPath: string;
  projectName: string;
  lastActivity: Date;
  filePath: string;
}

// ADR 0009: active session = file modified within 2 hours
const ACTIVE_THRESHOLD_MS = 2 * 60 * 60 * 1000;

const CLAUDE_PROJECTS_DIR = path.join(
  process.env.HOME ?? process.env.USERPROFILE ?? '',
  '.claude',
  'projects'
);

/** Scan ~/.claude/projects/ for active sessions */
export function getActiveSessions(): ActiveSession[] {
  const sessions: ActiveSession[] = [];
  const now = Date.now();

  if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) {
    return sessions;
  }

  try {
    const projectDirs = fs.readdirSync(CLAUDE_PROJECTS_DIR);

    for (const projectDir of projectDirs) {
      const projectPath = path.join(CLAUDE_PROJECTS_DIR, projectDir);
      const stat = fs.statSync(projectPath);
      if (!stat.isDirectory()) continue;

      const files = fs.readdirSync(projectPath);
      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;

        const filePath = path.join(projectPath, file);
        const fileStat = fs.statSync(filePath);
        const age = now - fileStat.mtimeMs;

        if (age <= ACTIVE_THRESHOLD_MS) {
          const sessionId = file.replace('.jsonl', '');
          sessions.push({
            sessionId,
            projectPath: projectDir,
            projectName: extractProjectName(projectDir),
            lastActivity: new Date(fileStat.mtimeMs),
            filePath,
          });
        }
      }
    }
  } catch (err) {
    logger.warn('Error scanning Claude projects directory', err);
  }

  return sessions.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
}

/** Extract a readable project name from the directory hash format */
function extractProjectName(dirName: string): string {
  // Claude Code uses path-based directory names like "-Users-username-Desktop-myproject"
  const parts = dirName.split('-').filter(Boolean);
  return parts[parts.length - 1] ?? dirName;
}
