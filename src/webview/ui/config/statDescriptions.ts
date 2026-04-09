export const SESSION_STAT_DESCRIPTIONS: Record<string, string> = {
  'INPUT TOKENS': 'Input tokens are sent TO Claude: your prompts, file contents, and conversation history. Large codebases re-read each turn, driving this up fast.',
  'OUTPUT TOKENS': 'Output tokens come FROM Claude: the responses you read.',
  'PEAK TOKENS': 'Peak hours are weekdays 5–11 AM Pacific. Tokens here count separately toward your rate limit.',
  'OFF-PEAK TOKENS': 'Off-peak tokens are everything outside weekday 5–11 AM Pacific. You get more before hitting limits.',
  'BURN RATE': 'Tokens consumed per minute, averaged over the last 10 minutes. Shows LEARNING until enough data, or STALE if no recent activity.',
  'TIME TO LIMIT': 'Estimated time until rate limit based on your personal history. More accurate after several limit hits. Shows STALE when burn rate data has timed out.',
  'SESSION TIME': 'Wall clock time since your first interaction. Long sessions don\'t directly affect limits, burn rate does.',
};

export const CONTEXT_STAT_DESCRIPTIONS: Record<string, string> = {
  'EST. CONTEXT USED': 'Estimated tokens filling Claude\'s context window. Includes input, cached, and newly written tokens from the most recent turn.',
  'CONTEXT MAX': 'Maximum context window for the model. All Claude models currently support 200K tokens.',
  'UTILISATION': 'Percentage of the context window currently in use. Above 80% consider using /clear.',
};

export const CACHE_STAT_DESCRIPTIONS: Record<string, string> = {
  'CACHE STATE': 'FRESH means cache is active. EXPIRING means under 60s left. EXPIRED means next turn rebuilds the full context.',
  'IDLE TIME': 'Time since your last interaction. Cache expires after ~5 minutes of inactivity.',
  'CACHE SIZE': 'Estimated tokens currently held in cache. These get read at a discount instead of reprocessed.',
  'HITS TODAY': 'Turns today where cached context was reused — each one saved you tokens.',
  'MISSES TODAY': 'Turns today where the cache had to be rebuilt from scratch. Usually after idle periods.',
  'SAVED TODAY': 'Tokens NOT charged at full price today thanks to cache hits.',
};

export const STATS_CARD_DESCRIPTIONS: Record<string, string> = {
  'TOTAL': 'Total tokens consumed across the displayed period. Input and output combined.',
  'PEAK %': 'Percentage of tokens consumed during peak hours (weekdays 5-11 AM Pacific).',
  'LIMIT HITS': 'Number of times you hit the rate limit in this period. More hits = more disrupted flow.',
  'AVG/DAY': 'Average tokens per active day. Days with no usage are excluded.',
};

export const COST_CARD_DESCRIPTIONS: Record<string, string> = {
  'TOTAL': 'Estimated API-equivalent cost for this period. Not your actual bill. Subscription users pay a flat fee.',
  'AVG/DAY': 'Average daily cost on active days. Helps gauge your typical spending pattern.',
  'LIMIT HITS': 'Rate limit events. These don\'t cost money but they cost time.',
};

export const HISTORY_CARD_DESCRIPTIONS: Record<string, string> = {
  'TOTAL': 'Total tokens consumed in this period. Compare across periods to spot trends.',
  'YR SO FAR': 'Total tokens consumed from January 1 to today.',
  'PEAK %': 'Percentage of tokens used during peak hours. Lower is better for avoiding limits.',
  'LIMIT HITS': 'Rate limit events in this period. Each one interrupted your workflow.',
  'AVG/DAY': 'Average daily token consumption on days you actually used Claude Code.',
};
