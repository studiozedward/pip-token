import { isPeak } from '../domain/peakHourSchedule';

/** Classify a turn as peak or off-peak based on its timestamp */
export function classifyPeakStatus(timestamp: Date): 'peak' | 'off-peak' {
  return isPeak(timestamp) ? 'peak' : 'off-peak';
}
