/**
 * Limit hit detection.
 *
 * Active detection methods:
 * - explicit_429: parsed from JSONL `error: "rate_limit"` events by the
 *   watcher (claudeCodeWatcher.ts), with plan-tier-aware dedup
 * - manual: user clicks "LOG LIMIT HIT NOW" in the About page
 *
 * Timing gap detection was removed — it produced false positives from
 * normal work pauses and corrupted window aggregates.
 */

/** Reset the detector state (reserved for future stateful detection). */
export function resetLimitHitDetector(): void {
  // no-op — explicit_429 detection is stateless (dedup via DB query)
}
