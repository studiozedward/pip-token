import { ParsedTurn } from './jsonlParser';
import { logger } from '../utils/logger';

export interface DetectedLimitHit {
  timestamp: string;
  detectionMethod: 'explicit_429' | 'timing_gap' | 'manual';
  notes: string;
}

// Minimum gap in milliseconds to suspect a limit hit (45 minutes)
const TIMING_GAP_THRESHOLD_MS = 45 * 60 * 1000;

let lastTurnTimestamp: Date | null = null;

/**
 * Check if a turn indicates a limit hit.
 * Currently checks for timing gaps. Explicit 429 detection will be added
 * once we observe the actual error format in JSONL logs.
 */
export function checkForLimitHit(turn: ParsedTurn): DetectedLimitHit | null {
  const currentTime = new Date(turn.timestamp);

  if (lastTurnTimestamp) {
    const gap = currentTime.getTime() - lastTurnTimestamp.getTime();

    if (gap >= TIMING_GAP_THRESHOLD_MS) {
      logger.info(`Potential limit hit detected: ${Math.round(gap / 60000)} minute gap`);
      lastTurnTimestamp = currentTime;
      return {
        timestamp: turn.timestamp,
        detectionMethod: 'timing_gap',
        notes: `${Math.round(gap / 60000)} minute gap between turns`,
      };
    }
  }

  lastTurnTimestamp = currentTime;
  return null;
}

/** Reset the detector state (e.g. on extension restart) */
export function resetLimitHitDetector(): void {
  lastTurnTimestamp = null;
}
