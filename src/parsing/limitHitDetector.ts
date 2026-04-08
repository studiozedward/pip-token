import { ParsedTurn } from './jsonlParser';
import { logger } from '../utils/logger';

export interface DetectedLimitHit {
  timestamp: string;
  detectionMethod: 'explicit_429' | 'timing_gap' | 'manual';
  notes: string;
}

/**
 * Check if a turn indicates a limit hit.
 *
 * Timing gap detection has been disabled — it produced too many false
 * positives from normal work pauses (lunch, meetings, context switches)
 * and each false positive closed the active window, corrupting aggregates.
 *
 * Active detection methods:
 * - explicit_429: not yet implemented (waiting for a real 429 JSONL sample)
 * - manual: user clicks "I just hit a limit" in the UI
 *
 * This function currently always returns null. Limit hits are recorded
 * only via the manual logLimitHit message or future 429 detection.
 */
export function checkForLimitHit(_turn: ParsedTurn): DetectedLimitHit | null {
  // TODO: add explicit_429 detection once we observe the error format in JSONL logs
  return null;
}

/** Reset the detector state (no-op now that timing gap is disabled) */
export function resetLimitHitDetector(): void {
  // no-op
}
