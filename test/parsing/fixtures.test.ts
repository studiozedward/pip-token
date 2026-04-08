import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseLines } from '../../src/parsing/jsonlParser';

const fixturesDir = path.join(__dirname, '../fixtures/sample-sessions');

describe('fixture compatibility', () => {
  it('basic-session produces exactly 1 completed turn', () => {
    const content = fs.readFileSync(
      path.join(fixturesDir, 'basic-session-sanitised.jsonl'),
      'utf-8'
    );
    const { turns } = parseLines(content);

    expect(turns).toHaveLength(1);
    expect(turns[0].stopReason).toBe('end_turn');
    expect(turns[0].sessionId).toBe('aaaaaaaa-1111-2222-3333-444444444444');
    expect(turns[0].inputTokens).toBe(3);
    expect(turns[0].outputTokens).toBe(85);
  });

  it('tool-use-session produces turns with stop_reason "tool_use"', () => {
    const content = fs.readFileSync(
      path.join(fixturesDir, 'tool-use-session-sanitised.jsonl'),
      'utf-8'
    );
    const { turns } = parseLines(content);

    // The fixture has: 1 streaming chunk (skipped), 1 tool_use turn, 1 end_turn follow-up
    expect(turns.length).toBeGreaterThanOrEqual(2);

    const toolUseTurns = turns.filter(t => t.stopReason === 'tool_use');
    expect(toolUseTurns.length).toBeGreaterThanOrEqual(1);
    expect(toolUseTurns[0].stopReason).toBe('tool_use');
  });

  it('multi-turn-with-cache produces 3 turns with increasing cache_read_input_tokens', () => {
    const content = fs.readFileSync(
      path.join(fixturesDir, 'multi-turn-with-cache-sanitised.jsonl'),
      'utf-8'
    );
    const { turns } = parseLines(content);

    expect(turns).toHaveLength(3);

    // Cache read tokens should increase across turns
    expect(turns[0].cacheReadInputTokens).toBe(0);
    expect(turns[1].cacheReadInputTokens).toBe(12000);
    expect(turns[2].cacheReadInputTokens).toBe(12500);

    // Each subsequent turn should have cache_read >= previous
    for (let i = 1; i < turns.length; i++) {
      expect(turns[i].cacheReadInputTokens).toBeGreaterThanOrEqual(
        turns[i - 1].cacheReadInputTokens
      );
    }
  });
});
