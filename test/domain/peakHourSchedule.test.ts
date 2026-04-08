import { describe, it, expect } from 'vitest';
import { isPeak } from '../../src/domain/peakHourSchedule';

// All dates use January 2026 to avoid DST complications.
// January is PST (UTC-8), so Pacific = UTC - 8 hours.
// 2026-01-14 is a Wednesday.

describe('isPeak', () => {
  it('returns true for weekday at 8:00 AM Pacific (16:00 UTC)', () => {
    // Wednesday 2026-01-14, 8AM Pacific = 16:00 UTC
    const date = new Date('2026-01-14T16:00:00.000Z');
    expect(isPeak(date)).toBe(true);
  });

  it('returns false for weekday at 2:00 PM Pacific (22:00 UTC)', () => {
    // Wednesday 2026-01-14, 2PM Pacific = 22:00 UTC
    const date = new Date('2026-01-14T22:00:00.000Z');
    expect(isPeak(date)).toBe(false);
  });

  it('returns false for weekend at 8:00 AM Pacific', () => {
    // Saturday 2026-01-17, 8AM Pacific = 16:00 UTC
    const date = new Date('2026-01-17T16:00:00.000Z');
    expect(isPeak(date)).toBe(false);
  });

  it('returns true at 5:00 AM Pacific exactly (start inclusive)', () => {
    // Wednesday 2026-01-14, 5AM Pacific = 13:00 UTC
    const date = new Date('2026-01-14T13:00:00.000Z');
    expect(isPeak(date)).toBe(true);
  });

  it('returns false at 11:00 AM Pacific exactly (end exclusive)', () => {
    // Wednesday 2026-01-14, 11AM Pacific = 19:00 UTC
    const date = new Date('2026-01-14T19:00:00.000Z');
    expect(isPeak(date)).toBe(false);
  });

  it('returns false at 4:59 AM Pacific (before start)', () => {
    // Wednesday 2026-01-14, 4:59AM Pacific = 12:59 UTC
    const date = new Date('2026-01-14T12:59:00.000Z');
    expect(isPeak(date)).toBe(false);
  });
});
