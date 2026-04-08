import { describe, it, expect } from 'vitest';
import { parseLine, parseLines } from '../../src/parsing/jsonlParser';

// --- Helper: build a minimal valid assistant line ---
function makeAssistantLine(overrides: Record<string, unknown> = {}): string {
  const base = {
    type: 'assistant',
    sessionId: 'sess-001',
    requestId: 'req-001',
    timestamp: '2026-01-15T14:30:03.000Z',
    message: {
      model: 'claude-sonnet-4-6',
      role: 'assistant',
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation: {
          ephemeral_5m_input_tokens: 0,
          ephemeral_1h_input_tokens: 0,
        },
      },
      ...((overrides.message as Record<string, unknown>) ?? {}),
    },
    ...overrides,
  };
  // Don't let the top-level message override clobber the merge — rebuild properly
  if (overrides.message) {
    base.message = {
      ...base.message,
      ...(overrides.message as Record<string, unknown>),
    };
    if ((overrides.message as Record<string, unknown>).usage) {
      base.message.usage = {
        ...base.message.usage,
        ...((overrides.message as Record<string, unknown>).usage as Record<string, unknown>),
      };
    }
  }
  return JSON.stringify(base);
}

describe('parseLine', () => {
  it('parses a normal completed turn with stop_reason "end_turn"', () => {
    const line = makeAssistantLine();
    const result = parseLine(line);

    expect(result).not.toBeNull();
    expect(result!.sessionId).toBe('sess-001');
    expect(result!.requestId).toBe('req-001');
    expect(result!.timestamp).toBe('2026-01-15T14:30:03.000Z');
    expect(result!.model).toBe('claude-sonnet-4-6');
    expect(result!.inputTokens).toBe(100);
    expect(result!.outputTokens).toBe(50);
    expect(result!.stopReason).toBe('end_turn');
  });

  it('parses a tool_use turn', () => {
    const line = makeAssistantLine({
      message: {
        model: 'claude-sonnet-4-6',
        role: 'assistant',
        stop_reason: 'tool_use',
        usage: {
          input_tokens: 200,
          output_tokens: 120,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation: {
            ephemeral_5m_input_tokens: 0,
            ephemeral_1h_input_tokens: 0,
          },
        },
      },
    });
    const result = parseLine(line);

    expect(result).not.toBeNull();
    expect(result!.stopReason).toBe('tool_use');
    expect(result!.inputTokens).toBe(200);
    expect(result!.outputTokens).toBe(120);
  });

  it('skips streaming chunk (stop_reason null)', () => {
    const line = makeAssistantLine({
      message: {
        model: 'claude-sonnet-4-6',
        role: 'assistant',
        stop_reason: null,
        usage: {
          input_tokens: 3,
          output_tokens: 12,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
      },
    });
    const result = parseLine(line);
    expect(result).toBeNull();
  });

  it('skips user line', () => {
    const line = JSON.stringify({
      type: 'user',
      sessionId: 'sess-001',
      timestamp: '2026-01-15T14:30:00.200Z',
      message: { role: 'user', content: 'explain the main function' },
    });
    const result = parseLine(line);
    expect(result).toBeNull();
  });

  it('skips queue-operation line', () => {
    const line = JSON.stringify({
      type: 'queue-operation',
      operation: 'enqueue',
      timestamp: '2026-01-15T14:30:00.000Z',
      sessionId: 'sess-001',
      content: 'explain the main function',
    });
    const result = parseLine(line);
    expect(result).toBeNull();
  });

  it('skips empty line', () => {
    expect(parseLine('')).toBeNull();
    expect(parseLine('   ')).toBeNull();
  });

  it('returns null for malformed JSON (does not throw)', () => {
    expect(parseLine('this is not json {')).toBeNull();
    expect(parseLine('{broken')).toBeNull();
  });

  it('returns null when usage block is missing', () => {
    const data = {
      type: 'assistant',
      sessionId: 'sess-001',
      requestId: 'req-001',
      timestamp: '2026-01-15T14:30:03.000Z',
      message: {
        model: 'claude-sonnet-4-6',
        role: 'assistant',
        stop_reason: 'end_turn',
        // no usage block
      },
    };
    const result = parseLine(JSON.stringify(data));
    expect(result).toBeNull();
  });

  it('parses correctly when unknown fields are present', () => {
    const data = {
      type: 'assistant',
      sessionId: 'sess-001',
      requestId: 'req-001',
      timestamp: '2026-01-15T14:30:03.000Z',
      unknownTopLevel: 'should be ignored',
      message: {
        model: 'claude-sonnet-4-6',
        role: 'assistant',
        stop_reason: 'end_turn',
        unknownField: 42,
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          futureField: 999,
          cache_creation: {
            ephemeral_5m_input_tokens: 0,
            ephemeral_1h_input_tokens: 0,
            futureNestedField: true,
          },
        },
      },
    };
    const result = parseLine(JSON.stringify(data));
    expect(result).not.toBeNull();
    expect(result!.inputTokens).toBe(100);
    expect(result!.outputTokens).toBe(50);
  });

  it('extracts all cache fields correctly', () => {
    const data = {
      type: 'assistant',
      sessionId: 'sess-001',
      requestId: 'req-001',
      timestamp: '2026-01-15T14:30:03.000Z',
      message: {
        model: 'claude-sonnet-4-6',
        role: 'assistant',
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 3,
          output_tokens: 85,
          cache_creation_input_tokens: 200,
          cache_read_input_tokens: 5000,
          cache_creation: {
            ephemeral_5m_input_tokens: 100,
            ephemeral_1h_input_tokens: 200,
          },
        },
      },
    };
    const result = parseLine(JSON.stringify(data));
    expect(result).not.toBeNull();
    expect(result!.cacheCreationInputTokens).toBe(200);
    expect(result!.cacheReadInputTokens).toBe(5000);
    expect(result!.cache5mTokens).toBe(100);
    expect(result!.cache1hTokens).toBe(200);
  });
});

describe('parseLines', () => {
  it('filters mixed content and returns only completed turns', () => {
    const lines = [
      // queue-operation — skipped
      JSON.stringify({
        type: 'queue-operation',
        operation: 'enqueue',
        timestamp: '2026-01-15T14:30:00.000Z',
        sessionId: 'sess-001',
      }),
      // user — skipped
      JSON.stringify({
        type: 'user',
        sessionId: 'sess-001',
        timestamp: '2026-01-15T14:30:00.200Z',
        message: { role: 'user', content: 'hello' },
      }),
      // streaming chunk (stop_reason null) — skipped
      JSON.stringify({
        type: 'assistant',
        sessionId: 'sess-001',
        timestamp: '2026-01-15T14:30:01.000Z',
        message: {
          model: 'claude-sonnet-4-6',
          role: 'assistant',
          stop_reason: null,
          usage: { input_tokens: 3, output_tokens: 12 },
        },
      }),
      // completed turn — kept
      makeAssistantLine(),
    ].join('\n');

    const result = parseLines(lines);
    expect(result.turns).toHaveLength(1);
    expect(result.rateLimitEvents).toHaveLength(0);
    expect(result.turns[0].stopReason).toBe('end_turn');
    expect(result.turns[0].sessionId).toBe('sess-001');
  });

  it('detects rate_limit events separately from turns', () => {
    const lines = [
      // Normal turn
      makeAssistantLine(),
      // Rate limit event
      JSON.stringify({
        type: 'assistant',
        sessionId: 'sess-001',
        timestamp: '2026-01-15T15:00:00.000Z',
        error: 'rate_limit',
        isApiErrorMessage: true,
        message: {
          model: '<synthetic>',
          stop_reason: 'stop_sequence',
          usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
          content: [{ type: 'text', text: "You've hit your limit \u00b7 resets 4pm (Europe/London)" }],
        },
      }),
    ].join('\n');

    const result = parseLines(lines);
    expect(result.turns).toHaveLength(1);
    expect(result.rateLimitEvents).toHaveLength(1);
    expect(result.rateLimitEvents[0].sessionId).toBe('sess-001');
    expect(result.rateLimitEvents[0].timestamp).toBe('2026-01-15T15:00:00.000Z');
    expect(result.rateLimitEvents[0].message).toContain('hit your limit');
  });

  it('returns empty array for all-skipped content', () => {
    const lines = [
      JSON.stringify({ type: 'queue-operation', operation: 'enqueue', timestamp: 'x', sessionId: 's' }),
      JSON.stringify({ type: 'user', sessionId: 's', message: { role: 'user', content: 'hi' } }),
      '',
    ].join('\n');

    const result = parseLines(lines);
    expect(result.turns).toHaveLength(0);
    expect(result.rateLimitEvents).toHaveLength(0);
  });
});
