import { describe, it, expect } from 'vitest';
import { evaluateAdvisory } from '../../src/domain/advisoryEngine';
import type { AdvisoryRule, AdvisoryContext } from '../../src/domain/advisoryEngine';

describe('evaluateAdvisory', () => {
  const baseCtx: AdvisoryContext = { pageId: 'live.session' };

  it('returns null when rules array is empty', () => {
    expect(evaluateAdvisory([], baseCtx)).toBeNull();
  });

  it('returns null when no rules match the condition', () => {
    const rules: AdvisoryRule[] = [
      {
        pages: ['live.session'],
        condition: () => false,
        message: () => 'should not appear',
        priority: 1,
      },
    ];
    expect(evaluateAdvisory(rules, baseCtx)).toBeNull();
  });

  it('returns the message of a single matching rule', () => {
    const rules: AdvisoryRule[] = [
      {
        pages: ['live.session'],
        condition: () => true,
        message: () => 'High burn rate detected',
        priority: 1,
      },
    ];
    expect(evaluateAdvisory(rules, baseCtx)).toBe('High burn rate detected');
  });

  it('returns the higher priority message when multiple rules match', () => {
    const rules: AdvisoryRule[] = [
      {
        pages: ['live.session'],
        condition: () => true,
        message: () => 'Low priority message',
        priority: 1,
      },
      {
        pages: ['live.session'],
        condition: () => true,
        message: () => 'High priority message',
        priority: 10,
      },
    ];
    expect(evaluateAdvisory(rules, baseCtx)).toBe('High priority message');
  });

  it('filters out rules that do not match the current page', () => {
    const rules: AdvisoryRule[] = [
      {
        pages: ['live.session'],
        condition: () => true,
        message: () => 'Session advisory',
        priority: 1,
      },
    ];

    const contextCtx: AdvisoryContext = { pageId: 'live.context' };
    expect(evaluateAdvisory(rules, contextCtx)).toBeNull();
  });

  it('skips a rule whose condition throws an error', () => {
    const rules: AdvisoryRule[] = [
      {
        pages: ['live.session'],
        condition: () => {
          throw new Error('broken condition');
        },
        message: () => 'should not appear',
        priority: 10,
      },
      {
        pages: ['live.session'],
        condition: () => true,
        message: () => 'Fallback message',
        priority: 1,
      },
    ];
    expect(evaluateAdvisory(rules, baseCtx)).toBe('Fallback message');
  });

  it('returns null when the winning rule message throws an error', () => {
    const rules: AdvisoryRule[] = [
      {
        pages: ['live.session'],
        condition: () => true,
        message: () => {
          throw new Error('broken message');
        },
        priority: 1,
      },
    ];
    expect(evaluateAdvisory(rules, baseCtx)).toBeNull();
  });
});
