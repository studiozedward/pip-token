import { logger } from '../utils/logger';

/** Raw JSONL line types observed in Claude Code logs */
export type LineType = 'queue-operation' | 'user' | 'assistant' | 'system' | 'unknown';

/** Parsed token usage from an assistant line */
export interface ParsedTurn {
  sessionId: string;
  requestId: string | null;
  timestamp: string;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  cache5mTokens: number;
  cache1hTokens: number;
  stopReason: string;
}

/** Parse a single JSONL line. Returns a ParsedTurn if it's a completed assistant turn, null otherwise. */
export function parseLine(line: string): ParsedTurn | null {
  if (!line.trim()) return null;

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(line);
  } catch {
    logger.warn('Skipping malformed JSONL line');
    return null;
  }

  const type = data.type as string | undefined;

  // Only process assistant lines
  if (type !== 'assistant') return null;

  const message = data.message as Record<string, unknown> | undefined;
  if (!message) return null;

  // CRITICAL: Only process completed turns, not streaming chunks.
  // Lines with stop_reason === null are intermediate streaming chunks
  // with partial output_tokens. The final line per requestId has the
  // complete output_tokens count.
  const stopReason = message.stop_reason as string | null;
  if (stopReason === null || stopReason === undefined || stopReason === 'None') {
    return null;
  }

  const usage = message.usage as Record<string, unknown> | undefined;
  if (!usage) return null;

  const cacheCreation = usage.cache_creation as Record<string, number> | undefined;

  return {
    sessionId: data.sessionId as string,
    requestId: (data.requestId as string) ?? null,
    timestamp: data.timestamp as string,
    model: (message.model as string) ?? null,
    inputTokens: (usage.input_tokens as number) ?? 0,
    outputTokens: (usage.output_tokens as number) ?? 0,
    cacheCreationInputTokens: (usage.cache_creation_input_tokens as number) ?? 0,
    cacheReadInputTokens: (usage.cache_read_input_tokens as number) ?? 0,
    cache5mTokens: cacheCreation?.ephemeral_5m_input_tokens ?? 0,
    cache1hTokens: cacheCreation?.ephemeral_1h_input_tokens ?? 0,
    stopReason,
  };
}

/** Parse multiple JSONL lines (e.g. from a file chunk). Returns completed turns only. */
export function parseLines(text: string): ParsedTurn[] {
  const turns: ParsedTurn[] = [];
  for (const line of text.split('\n')) {
    const turn = parseLine(line);
    if (turn) {
      turns.push(turn);
    }
  }
  return turns;
}
