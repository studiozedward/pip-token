// --- Bar chart SVG component (M4) ---
// Hand-rolled inline SVG. No chart libraries.

// --- Interfaces ---

interface BarData {
  label: string;
  peakValue: number;
  offpeakValue: number;
  limitHits: number;
}

interface BarChartOptions {
  bars: BarData[];
  averageLine: number | null;
  yAxisLabel: string;         // "TOKENS" or currency symbol like "£"
  isCostChart?: boolean;      // if true, format y-axis values as currency
  currencySymbol?: string;
}

// --- SVG colours (match CSS variables, hardcoded for SVG context) ---

const COLORS = {
  peakFill: '#00ff41',       // --green-bright
  offpeakFill: '#006a1a',    // --green-dim
  gridLine: '#003a0d',       // --green-darker
  label: '#00aa2b',          // --green-mid
  avgLine: '#00aa2b',        // --green-mid
  limitHit: '#ff4141',       // --alarm-red
  noDataText: '#006a1a',     // --green-dim
} as const;

// --- Layout constants ---

const VIEW_W = 400;
const VIEW_H = 200;
const MARGIN_LEFT = 50;
const MARGIN_BOTTOM = 25;
const MARGIN_TOP = 15;
const CHART_W = VIEW_W - MARGIN_LEFT;
const CHART_H = VIEW_H - MARGIN_TOP - MARGIN_BOTTOM;

// --- Formatting helpers ---

function formatCompact(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`;
  }
  return n.toString();
}

function formatCurrencyCompact(minorUnits: number, symbol: string): string {
  const major = minorUnits / 100;
  if (major >= 1_000_000) {
    const m = major / 1_000_000;
    return `${symbol}${m % 1 === 0 ? m : m.toFixed(1)}M`;
  }
  if (major >= 1_000) {
    const k = major / 1_000;
    return `${symbol}${k % 1 === 0 ? k : k.toFixed(1)}K`;
  }
  if (major >= 100) {
    return `${symbol}${Math.round(major)}`;
  }
  return `${symbol}${major.toFixed(2)}`;
}

function roundToNice(value: number): number {
  if (value <= 0) return 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  let nice: number;
  if (normalized <= 1) nice = 1;
  else if (normalized <= 2) nice = 2;
  else if (normalized <= 5) nice = 5;
  else nice = 10;
  return nice * magnitude;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- Main render function ---

export function renderBarChart(container: HTMLElement, options: BarChartOptions): void {
  const { bars, averageLine, yAxisLabel, isCostChart, currencySymbol } = options;

  // Detect empty data
  const totalValues = bars.reduce((sum, b) => sum + b.peakValue + b.offpeakValue, 0);
  if (bars.length === 0 || totalValues === 0) {
    container.innerHTML = `
      <div class="chart-svg-container">
        <svg viewBox="0 0 ${VIEW_W} ${VIEW_H}" xmlns="http://www.w3.org/2000/svg">
          <text x="${VIEW_W / 2}" y="${VIEW_H / 2}" text-anchor="middle"
                font-family="'VT323','Courier New',monospace" font-size="12"
                fill="${COLORS.noDataText}">NO DATA FOR THIS PERIOD</text>
        </svg>
      </div>
    `;
    return;
  }

  // Calculate max value
  let rawMax = 0;
  for (const bar of bars) {
    const barTotal = bar.peakValue + bar.offpeakValue;
    if (barTotal > rawMax) rawMax = barTotal;
  }
  if (averageLine !== null && averageLine > rawMax) {
    rawMax = averageLine;
  }
  const maxValue = roundToNice(rawMax);

  // Y-axis formatter
  const formatY = (value: number): string => {
    if (isCostChart && currencySymbol) {
      return formatCurrencyCompact(value, currencySymbol);
    }
    return formatCompact(value);
  };

  // Start building SVG parts
  const parts: string[] = [];

  // Gridlines and y-axis labels
  const gridSteps = [0, 0.25, 0.5, 0.75, 1.0];
  for (const pct of gridSteps) {
    const yVal = maxValue * pct;
    const y = MARGIN_TOP + CHART_H - (CHART_H * pct);

    // Gridline
    parts.push(
      `<line x1="${MARGIN_LEFT}" y1="${y}" x2="${VIEW_W}" y2="${y}" ` +
      `stroke="${COLORS.gridLine}" stroke-width="0.5" stroke-dasharray="2,2"/>`
    );

    // Y-axis label
    parts.push(
      `<text x="${MARGIN_LEFT - 4}" y="${y + 3}" text-anchor="end" ` +
      `font-family="'VT323','Courier New',monospace" font-size="8" ` +
      `fill="${COLORS.label}">${escapeXml(formatY(yVal))}</text>`
    );
  }

  // Y-axis title
  parts.push(
    `<text x="8" y="${MARGIN_TOP + CHART_H / 2}" text-anchor="middle" ` +
    `font-family="'VT323','Courier New',monospace" font-size="8" ` +
    `fill="${COLORS.label}" transform="rotate(-90, 8, ${MARGIN_TOP + CHART_H / 2})">${escapeXml(yAxisLabel)}</text>`
  );

  // Bars
  const barCount = bars.length;
  const totalBarSpace = CHART_W;
  const gapRatio = 0.3; // 30% gap between bars
  const barWidth = totalBarSpace / (barCount + (barCount - 1) * gapRatio + gapRatio); // gapRatio on each side
  const gapWidth = barWidth * gapRatio;

  for (let i = 0; i < barCount; i++) {
    const bar = bars[i];
    const x = MARGIN_LEFT + (gapWidth / 2) + i * (barWidth + gapWidth);

    // Off-peak (bottom)
    const offpeakHeight = maxValue > 0 ? (bar.offpeakValue / maxValue) * CHART_H : 0;
    const peakHeight = maxValue > 0 ? (bar.peakValue / maxValue) * CHART_H : 0;
    const totalHeight = offpeakHeight + peakHeight;

    const barBottom = MARGIN_TOP + CHART_H;

    if (offpeakHeight > 0) {
      parts.push(
        `<rect x="${x}" y="${barBottom - offpeakHeight}" width="${barWidth}" height="${offpeakHeight}" ` +
        `fill="${COLORS.offpeakFill}" opacity="0.6"/>`
      );
    }

    if (peakHeight > 0) {
      parts.push(
        `<rect x="${x}" y="${barBottom - totalHeight}" width="${barWidth}" height="${peakHeight}" ` +
        `fill="${COLORS.peakFill}"/>`
      );
    }

    // X-axis label
    const labelX = x + barWidth / 2;
    const labelY = barBottom + 14;
    parts.push(
      `<text x="${labelX}" y="${labelY}" text-anchor="middle" ` +
      `font-family="'VT323','Courier New',monospace" font-size="9" ` +
      `fill="${COLORS.label}">${escapeXml(bar.label)}</text>`
    );

    // Limit hit markers above bar
    if (bar.limitHits > 0) {
      const markerBaseY = barBottom - totalHeight - 3;

      if (bar.limitHits <= 5) {
        // Small red rectangles stacked vertically
        for (let j = 0; j < bar.limitHits; j++) {
          const rectY = markerBaseY - (j * 4);
          parts.push(
            `<rect x="${labelX - 1.5}" y="${rectY - 3}" width="3" height="3" fill="${COLORS.limitHit}"/>`
          );
        }
      } else {
        // Text "!N" for 6+
        parts.push(
          `<text x="${labelX}" y="${markerBaseY - 2}" text-anchor="middle" ` +
          `font-family="'VT323','Courier New',monospace" font-size="8" ` +
          `fill="${COLORS.limitHit}" font-weight="700">!${bar.limitHits}</text>`
        );
      }
    }
  }

  // Average line
  if (averageLine !== null && maxValue > 0) {
    const avgY = MARGIN_TOP + CHART_H - (averageLine / maxValue) * CHART_H;
    parts.push(
      `<line x1="${MARGIN_LEFT}" y1="${avgY}" x2="${VIEW_W - 4}" y2="${avgY}" ` +
      `stroke="${COLORS.avgLine}" stroke-width="1" stroke-dasharray="4,3"/>`
    );
    parts.push(
      `<text x="${VIEW_W - 2}" y="${avgY - 3}" text-anchor="end" ` +
      `font-family="'VT323','Courier New',monospace" font-size="7" ` +
      `fill="${COLORS.avgLine}">AVG</text>`
    );
  }

  // Assemble SVG
  container.innerHTML = `
    <div class="chart-svg-container">
      <svg viewBox="0 0 ${VIEW_W} ${VIEW_H}" xmlns="http://www.w3.org/2000/svg">
        ${parts.join('\n        ')}
      </svg>
    </div>
  `;
}
