import { describe, it, expect } from 'vitest';
import { turnCostMinor, getCurrencySymbol } from '../../src/domain/costCalculator';
import type { TurnCostInput } from '../../src/domain/costCalculator';

// Pricing from pricing.json for claude-sonnet-4-6:
//   input_per_million: 3.00
//   output_per_million: 15.00
//   cache_write_per_million: 3.75
//   cache_read_per_million: 0.30

describe('turnCostMinor', () => {
  it('calculates basic turn cost in USD', () => {
    const turn: TurnCostInput = {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      model: 'claude-sonnet-4-6',
    };

    // USD cost: (1M / 1M) * 3.00 + (1M / 1M) * 15.00 = 18.00
    // Minor units: 18.00 * 1.0 * 100 = 1800
    const cost = turnCostMinor(turn, 'USD');
    expect(cost).toBe(1800);
  });

  it('includes cache token costs', () => {
    const turn: TurnCostInput = {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 1_000_000,
      cache_read_input_tokens: 1_000_000,
      model: 'claude-sonnet-4-6',
    };

    // USD cost: (1M / 1M) * 3.75 + (1M / 1M) * 0.30 = 4.05
    // Minor units: 4.05 * 1.0 * 100 = 405
    const cost = turnCostMinor(turn, 'USD');
    expect(cost).toBe(405);
  });

  it('returns 0 for unknown model', () => {
    const turn: TurnCostInput = {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      model: 'nonexistent-model',
    };

    expect(turnCostMinor(turn, 'USD')).toBe(0);
  });

  it('applies currency conversion for GBP', () => {
    const turn: TurnCostInput = {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      model: 'claude-sonnet-4-6',
    };

    const usdCost = turnCostMinor(turn, 'USD');
    const gbpCost = turnCostMinor(turn, 'GBP');

    // GBP rate is 0.79, so GBP cost should be different from USD
    expect(gbpCost).not.toBe(usdCost);
    // GBP: 18.00 * 0.79 * 100 = 1422 (rounded)
    expect(gbpCost).toBe(Math.round(18.00 * 0.79 * 100));
  });
});

describe('getCurrencySymbol', () => {
  it('returns $ for USD', () => {
    expect(getCurrencySymbol('USD')).toBe('$');
  });

  it('returns the pound sign for GBP', () => {
    expect(getCurrencySymbol('GBP')).toBe('\u00A3');
  });

  it('returns the euro sign for EUR', () => {
    expect(getCurrencySymbol('EUR')).toBe('\u20AC');
  });

  it('returns the currency code itself for unknown currencies', () => {
    expect(getCurrencySymbol('XYZ')).toBe('XYZ');
    expect(getCurrencySymbol('BRL')).toBe('BRL');
  });
});
