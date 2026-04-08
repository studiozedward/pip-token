/**
 * Pure functions for converting token counts to cost in minor currency units.
 * All pricing data comes from pricing.json — never hardcode prices.
 */

import pricingData from './pricing.json';

// --- Interfaces ---

export interface TurnCostInput {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  model: string | null;
}

interface ModelPricingEntry {
  input_per_million: number;
  output_per_million: number;
  cache_write_per_million: number;
  cache_read_per_million: number;
  context_window: number;
}

interface CurrencyRates {
  [currency: string]: number;
}

// --- Typed access to pricing.json ---

const modelPricing: Record<string, ModelPricingEntry> =
  pricingData.models as unknown as Record<string, ModelPricingEntry>;

const currencyRates: CurrencyRates =
  pricingData.currency.rates as unknown as CurrencyRates;

const DEFAULT_MODEL = 'claude-sonnet-4-6';

// --- Public functions ---

/**
 * Calculate cost of a single turn in minor currency units (cents/pence).
 * Returns 0 if the model is not found in pricing.json.
 */
export function turnCostMinor(turn: TurnCostInput, currency: string): number {
  const model = turn.model ?? DEFAULT_MODEL;
  const pricing = modelPricing[model];
  if (!pricing) {
    return 0;
  }

  const usdCost =
    (turn.input_tokens / 1_000_000) * pricing.input_per_million +
    (turn.output_tokens / 1_000_000) * pricing.output_per_million +
    (turn.cache_creation_input_tokens / 1_000_000) * pricing.cache_write_per_million +
    (turn.cache_read_input_tokens / 1_000_000) * pricing.cache_read_per_million;

  const rate = currencyRates[currency] ?? 1.0;
  return Math.round(usdCost * rate * 100); // minor units
}

/**
 * Get the display symbol for a currency code.
 */
export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    GBP: '\u00A3',
    EUR: '\u20AC',
    CAD: 'CA$',
    AUD: 'A$',
    JPY: '\u00A5',
  };
  return symbols[currency] ?? currency;
}

/**
 * Detect a sensible default currency from the system locale.
 */
export function getDefaultCurrency(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? 'en-US';
    if (locale.endsWith('-GB')) return 'GBP';
    if (locale.endsWith('-EU') || locale.startsWith('de') || locale.startsWith('fr') || locale.startsWith('it') || locale.startsWith('es') || locale.startsWith('nl')) return 'EUR';
    if (locale.endsWith('-CA')) return 'CAD';
    if (locale.endsWith('-AU')) return 'AUD';
    if (locale.endsWith('-JP') || locale.startsWith('ja')) return 'JPY';
  } catch {
    // Locale detection unavailable — fall through to default
  }
  return 'USD';
}
