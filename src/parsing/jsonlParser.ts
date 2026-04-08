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

/** A rate_limit event logged by Claude Code when the user hits their limit. */
export interface ParsedRateLimitEvent {
  sessionId: string;
  timestamp: string;
  message: string; // e.g. "You've hit your limit · resets 4pm (Europe/London)"
}

/** Parse a JSONL line as a rate_limit event. Returns null if it isn't one. */
function parseRateLimitEvent(data: Record<string, unknown>): ParsedRateLimitEvent | null {
  if (data.error !== 'rate_limit') return null;
  if (data.isApiErrorMessage !== true) return null;

  const message = data.message as Record<string, unknown> | undefined;
  const content = message?.content as Array<{ type: string; text?: string }> | undefined;
  const text = content?.find(c => c.type === 'text')?.text ?? '';

  return {
    sessionId: data.sessionId as string,
    timestamp: data.timestamp as string,
    message: text,
  };
}

/** Result of parsing a chunk of JSONL lines. */
export interface ParseResult {
  turns: ParsedTurn[];
  rateLimitEvents: ParsedRateLimitEvent[];
}

/** Parse multiple JSONL lines (e.g. from a file chunk). */
export function parseLines(text: string): ParseResult {
  const turns: ParsedTurn[] = [];
  const rateLimitEvents: ParsedRateLimitEvent[] = [];

  for (const line of text.split('\n')) {
    if (!line.trim()) continue;

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(line);
    } catch {
      logger.warn('Skipping malformed JSONL line');
      continue;
    }

    // Check for rate limit event first
    const rateLimit = parseRateLimitEvent(data);
    if (rateLimit) {
      rateLimitEvents.push(rateLimit);
      continue;
    }

    // Try parsing as a normal turn
    const turn = parseLineFromData(data);
    if (turn) {
      turns.push(turn);
    }
  }

  return { turns, rateLimitEvents };
}

/** Parse a pre-parsed JSON object as an assistant turn. */
function parseLineFromData(data: Record<string, unknown>): ParsedTurn | null {
  const type = data.type as string | undefined;
  if (type !== 'assistant') return null;

  const message = data.message as Record<string, unknown> | undefined;
  if (!message) return null;

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

  return parseLineFromData(data);
}
