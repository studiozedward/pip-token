/**
 * Peak hour schedule — single source of truth.
 * Peak hours: weekdays (Mon-Fri) 5:00-11:00 Pacific Time.
 * See ADR 0003.
 */

const PEAK_START_HOUR = 5;  // 5:00 AM Pacific
const PEAK_END_HOUR = 11;   // 11:00 AM Pacific

/** Convert a Date to Pacific time hour and day-of-week */
function toPacific(date: Date): { hour: number; dayOfWeek: number } {
  const hourFormat = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    hour12: false,
  });
  const dayFormat = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short',
  });
  const hour = parseInt(hourFormat.format(date), 10);
  const dayStr = dayFormat.format(date);
  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return { hour, dayOfWeek: dayMap[dayStr] ?? 0 };
}

/** Check if a timestamp falls within Anthropic's peak window */
export function isPeak(date: Date): boolean {
  const { hour, dayOfWeek } = toPacific(date);

  // Weekdays only (Mon=1 through Fri=5)
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  if (!isWeekday) return false;

  // 5:00 AM to 10:59 AM Pacific (end hour exclusive, matching half-open interval convention)
  return hour >= PEAK_START_HOUR && hour < PEAK_END_HOUR;
}
