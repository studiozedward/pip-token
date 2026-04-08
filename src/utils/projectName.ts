import * as fs from 'fs';
import * as path from 'path';

/**
 * Decode a Claude Code encoded directory name to extract the project folder name.
 *
 * Claude Code encodes absolute paths by replacing '/' and ' ' with '-'.
 * e.g. /Users/ziad/Desktop/Claude Projects/pip-token
 *    → -Users-ziad-Desktop-Claude-Projects-pip-token
 *
 * This is lossy, so we probe the real filesystem to find where
 * path separators and spaces were.
 */
export function extractProjectName(encodedDir: string): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
  if (!home) {
    return fallback(encodedDir);
  }

  // Strip leading '-' and encode home the same way to find the prefix
  const stripped = encodedDir.replace(/^-/, '');
  const homeEncoded = home.replace(/^\//, '').replace(/[/ ]/g, '-');

  if (!stripped.startsWith(homeEncoded + '-')) {
    return fallback(encodedDir);
  }

  const remaining = stripped.slice(homeEncoded.length + 1);
  if (!remaining) {
    return path.basename(home);
  }

  const segments = remaining.split('-');
  let currentPath = home;
  let projectName = remaining; // fallback: whole remainder

  let i = 0;
  while (i < segments.length) {
    let matched = false;

    // Try progressively longer hyphenated/spaced names at this position
    for (let len = 1; len <= segments.length - i; len++) {
      const candidate = segments.slice(i, i + len).join('-');
      const candidateSpaced = segments.slice(i, i + len).join(' ');

      const withHyphen = path.join(currentPath, candidate);
      const withSpace = path.join(currentPath, candidateSpaced);

      // Check hyphenated name first (more common for project dirs)
      try {
        if (fs.existsSync(withHyphen) && fs.statSync(withHyphen).isDirectory()) {
          currentPath = withHyphen;
          projectName = candidate;
          i += len;
          matched = true;
          break;
        }
      } catch { /* ignore */ }

      // Then try spaced name (e.g. "Claude Projects")
      if (candidate !== candidateSpaced) {
        try {
          if (fs.existsSync(withSpace) && fs.statSync(withSpace).isDirectory()) {
            currentPath = withSpace;
            projectName = candidateSpaced;
            i += len;
            matched = true;
            break;
          }
        } catch { /* ignore */ }
      }
    }

    if (!matched) {
      // Remaining segments couldn't be matched — treat them as the project name
      projectName = segments.slice(i).join('-');
      break;
    }
  }

  return projectName;
}

/** Last dash-separated segment as a fallback */
function fallback(encodedDir: string): string {
  const parts = encodedDir.split('-').filter(Boolean);
  return parts[parts.length - 1] ?? encodedDir;
}
