/** Format a number with commas: 47283 → "47,283" */
export function formatWithCommas(n: number): string {
  return n.toLocaleString('en-US');
}

/** Format a number compactly: 412000 → "412K", 1500000 → "1.5M" */
export function formatCompact(n: number): string {
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

/** Format tokens per minute: 1200 → "1.2K/MIN" */
export function formatBurnRate(tokensPerMinute: number): string {
  return `${formatCompact(tokensPerMinute)}/MIN`;
}
