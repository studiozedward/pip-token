/**
 * Pure functions for aggregating turn data into time-bucketed chart data.
 * Used by the STATS and HISTORY pages.
 *
 * No database imports — all data is passed as parameters.
 * Peak classification uses the is_peak flag already stored on each turn.
 */

import type { TurnRecord } from '../data/repositories/turnRepo';
import type { LimitHitRecord } from '../data/repositories/limitHitRepo';
import { turnCostMinor } from './costCalculator';
import type { TurnCostInput } from './costCalculator';

// --- Exported interfaces ---

export interface ChartBar {
  label: string;
  peakValue: number;
  offpeakValue: number;
  limitHits: number;
}

export interface StatsCards {
  total: number;
  peakPct: number;
  limitHits: number;
  avgPerDay: number;
}

export interface CostCards {
  total: number;       // minor currency units
  avgPerDay: number;   // minor currency units
  limitHits: number;
}

export interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

interface AggregateResult {
  bars: ChartBar[];
  cards: StatsCards;
  averageLine: number | null;
}

interface CostAggregateResult {
  bars: ChartBar[];
  cards: CostCards;
  averageLine: number | null;
}

// --- Day name constants ---

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_LABELS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// --- Internal helpers ---

/** Get the Monday of the week containing the given date (local time). */
function getMondayOfWeek(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayOfWeek = copy.getDay(); // 0=Sun, 1=Mon, ...
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // shift so Mon=0
  copy.setDate(copy.getDate() - diff);
  return copy;
}

/** Get start of quarter containing a date. */
function getQuarterStart(d: Date): Date {
  const month = d.getMonth();
  const qMonth = month - (month % 3);
  return new Date(d.getFullYear(), qMonth, 1);
}

/** Format date as "D MMM" (e.g., "31 MAR"). */
function formatDayMonth(d: Date): string {
  return `${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`;
}

/** Get quarter number (1-4) from a month (0-11). */
function quarterNumber(month: number): number {
  return Math.floor(month / 3) + 1;
}

/** Check if a date falls within [start, end). */
function dateInRange(ts: string, start: Date, end: Date): boolean {
  const t = new Date(ts).getTime();
  return t >= start.getTime() && t < end.getTime();
}

/** Bucket a timestamp into the day-of-range index (0-based). */
function dayIndex(ts: string, rangeStart: Date): number {
  const t = new Date(ts);
  const localDay = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  const startDay = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate());
  return Math.floor((localDay.getTime() - startDay.getTime()) / (24 * 60 * 60 * 1000));
}

/** Compute StatsCards from peak/offpeak totals and active day count. */
function buildStatsCards(peakTotal: number, offpeakTotal: number, limitHitCount: number, activeDays: number): StatsCards {
  const total = peakTotal + offpeakTotal;
  return {
    total,
    peakPct: total > 0 ? Math.round((peakTotal / total) * 100) : 0,
    limitHits: limitHitCount,
    avgPerDay: activeDays > 0 ? Math.round(total / activeDays) : 0,
  };
}

/** Compute the average line value (mean of non-zero bar totals). */
function computeAverageLine(bars: ChartBar[]): number | null {
  const nonZero = bars.filter(b => b.peakValue + b.offpeakValue > 0);
  if (nonZero.length === 0) return null;
  const sum = nonZero.reduce((acc, b) => acc + b.peakValue + b.offpeakValue, 0);
  return Math.round(sum / nonZero.length);
}

/** Turn a TurnRecord into the shape expected by turnCostMinor. */
function toTurnCostInput(t: TurnRecord): TurnCostInput {
  return {
    input_tokens: t.input_tokens,
    output_tokens: t.output_tokens,
    cache_creation_input_tokens: t.cache_creation_input_tokens,
    cache_read_input_tokens: t.cache_read_input_tokens,
    model: t.model,
  };
}

// --- Public functions ---

/**
 * Compute the date range for a given page and period offset.
 * All ranges use local timezone boundaries.
 */
export function getDateRange(pageId: string, periodOffset: number): DateRange {
  const now = new Date();

  switch (pageId) {
    case 'stats.tokens':
    case 'stats.cost': {
      // Rolling 7 days ending today. Offset shifts by 7-day blocks.
      const endDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1); // midnight tomorrow
      endDay.setDate(endDay.getDate() + periodOffset * 7);
      const startDay = new Date(endDay);
      startDay.setDate(startDay.getDate() - 7);
      const label = periodOffset === 0 ? '7-DAY ROLLING' : '7-DAY ROLLING';
      return { start: startDay, end: endDay, label };
    }

    case 'history.week': {
      const monday = getMondayOfWeek(now);
      monday.setDate(monday.getDate() + periodOffset * 7);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 7); // exclusive end
      const label = `WEEK OF ${formatDayMonth(monday)}`;
      return { start: monday, end: sunday, label };
    }

    case 'history.month': {
      const year = now.getFullYear();
      const month = now.getMonth() + periodOffset;
      // JS handles month overflow automatically
      const start = new Date(year, month, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      const label = `${MONTH_LABELS[start.getMonth()]} ${start.getFullYear()}`;
      // Use full month name for display
      const fullMonths = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
      return { start, end, label: `${fullMonths[start.getMonth()]} ${start.getFullYear()}` };
    }

    case 'history.quarter': {
      const qStart = getQuarterStart(now);
      qStart.setMonth(qStart.getMonth() + periodOffset * 3);
      const qEnd = new Date(qStart.getFullYear(), qStart.getMonth() + 3, 1);
      const qNum = quarterNumber(qStart.getMonth());
      const label = `Q${qNum} ${qStart.getFullYear()}`;
      return { start: qStart, end: qEnd, label };
    }

    case 'history.year': {
      const yearNum = now.getFullYear() + periodOffset;
      const start = new Date(yearNum, 0, 1);
      const end = new Date(yearNum + 1, 0, 1);
      return { start, end, label: `${yearNum}` };
    }

    default:
      // Fallback: 7-day rolling
      return getDateRange('stats.tokens', periodOffset);
  }
}

/**
 * Aggregate turns into daily buckets.
 * Used for stats.tokens, stats.cost (token variant), and history.week.
 */
export function aggregateByDay(
  turns: TurnRecord[],
  limitHits: LimitHitRecord[],
  start: Date,
  end: Date,
): AggregateResult {
  const totalDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  const peakByDay = new Array<number>(totalDays).fill(0);
  const offpeakByDay = new Array<number>(totalDays).fill(0);
  const limitHitsByDay = new Array<number>(totalDays).fill(0);

  let peakTotal = 0;
  let offpeakTotal = 0;
  const activeDaySet = new Set<number>();

  for (const t of turns) {
    const idx = dayIndex(t.timestamp, start);
    if (idx < 0 || idx >= totalDays) continue;
    const tokens = t.input_tokens + t.output_tokens;
    if (t.is_peak) {
      peakByDay[idx] += tokens;
      peakTotal += tokens;
    } else {
      offpeakByDay[idx] += tokens;
      offpeakTotal += tokens;
    }
    activeDaySet.add(idx);
  }

  let totalLimitHits = 0;
  for (const h of limitHits) {
    if (!dateInRange(h.timestamp, start, end)) continue;
    const idx = dayIndex(h.timestamp, start);
    if (idx >= 0 && idx < totalDays) {
      limitHitsByDay[idx]++;
    }
    totalLimitHits++;
  }

  const bars: ChartBar[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    bars.push({
      label: DAY_LABELS[d.getDay()],
      peakValue: peakByDay[i],
      offpeakValue: offpeakByDay[i],
      limitHits: limitHitsByDay[i],
    });
  }

  const cards = buildStatsCards(peakTotal, offpeakTotal, totalLimitHits, activeDaySet.size);
  const averageLine = computeAverageLine(bars);

  return { bars, cards, averageLine };
}

/**
 * Aggregate turns into weekly buckets showing average daily tokens.
 * Used for history.month. Week 1 = days 1-7, Week 2 = days 8-14, etc.
 */
export function aggregateByWeek(
  turns: TurnRecord[],
  limitHits: LimitHitRecord[],
  start: Date,
  end: Date,
): AggregateResult {
  // Determine number of days in the month
  const totalDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  const numWeeks = Math.ceil(totalDays / 7); // W1-W5

  const peakByWeek = new Array<number>(numWeeks).fill(0);
  const offpeakByWeek = new Array<number>(numWeeks).fill(0);
  const limitHitsByWeek = new Array<number>(numWeeks).fill(0);
  // Track active days per week for averaging
  const activeDaysByWeek: Set<number>[] = Array.from({ length: numWeeks }, () => new Set<number>());

  let peakTotal = 0;
  let offpeakTotal = 0;
  const globalActiveDays = new Set<number>();

  for (const t of turns) {
    const dIdx = dayIndex(t.timestamp, start);
    if (dIdx < 0 || dIdx >= totalDays) continue;
    const wIdx = Math.min(Math.floor(dIdx / 7), numWeeks - 1);
    const tokens = t.input_tokens + t.output_tokens;
    if (t.is_peak) {
      peakByWeek[wIdx] += tokens;
      peakTotal += tokens;
    } else {
      offpeakByWeek[wIdx] += tokens;
      offpeakTotal += tokens;
    }
    activeDaysByWeek[wIdx].add(dIdx);
    globalActiveDays.add(dIdx);
  }

  let totalLimitHits = 0;
  for (const h of limitHits) {
    if (!dateInRange(h.timestamp, start, end)) continue;
    const dIdx = dayIndex(h.timestamp, start);
    if (dIdx < 0 || dIdx >= totalDays) continue;
    const wIdx = Math.min(Math.floor(dIdx / 7), numWeeks - 1);
    limitHitsByWeek[wIdx]++;
    totalLimitHits++;
  }

  const bars: ChartBar[] = [];
  for (let w = 0; w < numWeeks; w++) {
    const activeDays = activeDaysByWeek[w].size;
    bars.push({
      label: `W${w + 1}`,
      peakValue: activeDays > 0 ? Math.round(peakByWeek[w] / activeDays) : 0,
      offpeakValue: activeDays > 0 ? Math.round(offpeakByWeek[w] / activeDays) : 0,
      limitHits: limitHitsByWeek[w],
    });
  }

  const cards = buildStatsCards(peakTotal, offpeakTotal, totalLimitHits, globalActiveDays.size);
  const averageLine = computeAverageLine(bars);

  return { bars, cards, averageLine };
}

/**
 * Aggregate turns into monthly buckets showing average daily tokens.
 * Used for history.quarter and history.year.
 */
export function aggregateByMonth(
  turns: TurnRecord[],
  limitHits: LimitHitRecord[],
  start: Date,
  end: Date,
): AggregateResult {
  // Determine months between start and end
  const startYear = start.getFullYear();
  const startMonth = start.getMonth();
  const endYear = end.getFullYear();
  const endMonth = end.getMonth();
  const numMonths = (endYear - startYear) * 12 + (endMonth - startMonth);

  const peakByMonth = new Array<number>(numMonths).fill(0);
  const offpeakByMonth = new Array<number>(numMonths).fill(0);
  const limitHitsByMonth = new Array<number>(numMonths).fill(0);
  const activeDaysByMonth: Set<string>[] = Array.from({ length: numMonths }, () => new Set<string>());

  let peakTotal = 0;
  let offpeakTotal = 0;
  const globalActiveDays = new Set<string>();

  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  for (const t of turns) {
    const tDate = new Date(t.timestamp);
    const mIdx = (tDate.getFullYear() - startYear) * 12 + (tDate.getMonth() - startMonth);
    if (mIdx < 0 || mIdx >= numMonths) continue;
    const tokens = t.input_tokens + t.output_tokens;
    const dayKey = `${tDate.getFullYear()}-${tDate.getMonth()}-${tDate.getDate()}`;
    if (t.is_peak) {
      peakByMonth[mIdx] += tokens;
      peakTotal += tokens;
    } else {
      offpeakByMonth[mIdx] += tokens;
      offpeakTotal += tokens;
    }
    activeDaysByMonth[mIdx].add(dayKey);
    globalActiveDays.add(dayKey);
  }

  let totalLimitHits = 0;
  for (const h of limitHits) {
    if (!dateInRange(h.timestamp, start, end)) continue;
    const hDate = new Date(h.timestamp);
    const mIdx = (hDate.getFullYear() - startYear) * 12 + (hDate.getMonth() - startMonth);
    if (mIdx >= 0 && mIdx < numMonths) {
      limitHitsByMonth[mIdx]++;
    }
    totalLimitHits++;
  }

  const bars: ChartBar[] = [];
  for (let m = 0; m < numMonths; m++) {
    const monthDate = new Date(startYear, startMonth + m, 1);
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);

    // Future months get zero values, no projection
    const isFutureMonth = monthStart.getTime() >= todayEnd.getTime();
    const activeDays = activeDaysByMonth[m].size;

    bars.push({
      label: MONTH_LABELS[monthDate.getMonth()],
      peakValue: isFutureMonth ? 0 : (activeDays > 0 ? Math.round(peakByMonth[m] / activeDays) : 0),
      offpeakValue: isFutureMonth ? 0 : (activeDays > 0 ? Math.round(offpeakByMonth[m] / activeDays) : 0),
      limitHits: isFutureMonth ? 0 : limitHitsByMonth[m],
    });
  }

  const cards = buildStatsCards(peakTotal, offpeakTotal, totalLimitHits, globalActiveDays.size);
  const averageLine = computeAverageLine(bars);

  return { bars, cards, averageLine };
}

/**
 * Aggregate cost by day in minor currency units.
 * Used for stats.cost.
 */
export function aggregateCostByDay(
  turns: TurnRecord[],
  limitHits: LimitHitRecord[],
  start: Date,
  end: Date,
  currency: string,
): CostAggregateResult {
  const totalDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  const costByDay = new Array<number>(totalDays).fill(0);
  const limitHitsByDay = new Array<number>(totalDays).fill(0);

  let costTotal = 0;
  const activeDaySet = new Set<number>();

  for (const t of turns) {
    const idx = dayIndex(t.timestamp, start);
    if (idx < 0 || idx >= totalDays) continue;
    const cost = turnCostMinor(toTurnCostInput(t), currency);
    costByDay[idx] += cost;
    costTotal += cost;
    activeDaySet.add(idx);
  }

  let totalLimitHits = 0;
  for (const h of limitHits) {
    if (!dateInRange(h.timestamp, start, end)) continue;
    const idx = dayIndex(h.timestamp, start);
    if (idx >= 0 && idx < totalDays) {
      limitHitsByDay[idx]++;
    }
    totalLimitHits++;
  }

  // For cost bars, peakValue holds the full day cost, offpeakValue = 0
  // (cost is not split by peak/offpeak in the bar display)
  const bars: ChartBar[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    bars.push({
      label: DAY_LABELS[d.getDay()],
      peakValue: costByDay[i],
      offpeakValue: 0,
      limitHits: limitHitsByDay[i],
    });
  }

  const cards: CostCards = {
    total: costTotal,
    avgPerDay: activeDaySet.size > 0 ? Math.round(costTotal / activeDaySet.size) : 0,
    limitHits: totalLimitHits,
  };

  const averageLine = computeAverageLine(bars);

  return { bars, cards, averageLine };
}
