import { env } from '../../config/env.js';

export type FxProviderResult = {
  base: string;
  rates: Record<string, number>;
  source: string;
  sourceAsOf: string | null;
  confidence: 'low' | 'medium' | 'high';
};

function code(value: string) {
  return String(value || '').trim().toUpperCase().slice(0, 3);
}

function normalizeRates(input: unknown) {
  const out: Record<string, number> = {};
  if (!input || typeof input !== 'object') return out;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const rate = Number(value);
    const currency = code(key);
    if (currency.length === 3 && Number.isFinite(rate) && rate > 0) out[currency] = rate;
  }
  return out;
}

export async function fetchFrankfurterRates(baseRaw: string): Promise<FxProviderResult | null> {
  const base = code(baseRaw);
  try {
    const root = env.FRANKFURTER_BASE_URL.replace(/\/$/, '');
    const response = await fetch(`${root}/v2/rates?base=${encodeURIComponent(base)}`, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;
    const rows: any = await response.json();
    if (!Array.isArray(rows)) return null;
    const rates: Record<string, number> = { [base]: 1 };
    let latestDate: string | null = null;
    for (const row of rows) {
      const quote = code(row?.quote);
      const rate = Number(row?.rate);
      if (quote.length === 3 && Number.isFinite(rate) && rate > 0) rates[quote] = rate;
      if (typeof row?.date === 'string' && (!latestDate || row.date > latestDate)) latestDate = row.date;
    }
    if (Object.keys(rates).length <= 1) return null;
    return { base, rates, source: 'frankfurter', sourceAsOf: latestDate, confidence: 'high' };
  } catch {
    return null;
  }
}

export async function fetchOpenErRates(baseRaw: string): Promise<FxProviderResult | null> {
  const base = code(baseRaw);
  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${base}`, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;
    const data: any = await response.json();
    if (data?.result !== 'success') return null;
    const rates = normalizeRates(data?.rates);
    if (!Object.keys(rates).length) return null;
    rates[base] = 1;
    const sourceAsOf = Number(data?.time_last_update_unix) > 0
      ? new Date(Number(data.time_last_update_unix) * 1000).toISOString()
      : null;
    return { base, rates, source: 'open-er-api', sourceAsOf, confidence: 'medium' };
  } catch {
    return null;
  }
}

export async function fetchFawazRates(baseRaw: string): Promise<FxProviderResult | null> {
  const base = code(baseRaw);
  const lower = base.toLowerCase();
  const urls = [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${lower}.json`,
    `https://latest.currency-api.pages.dev/v1/currencies/${lower}.json`
  ];
  for (const url of urls) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) continue;
      const data: any = await response.json();
      const rates = normalizeRates(data?.[lower]);
      if (!Object.keys(rates).length) continue;
      rates[base] = 1;
      return {
        base,
        rates,
        source: url.includes('jsdelivr') ? 'fawaz-cdn' : 'fawaz-pages',
        sourceAsOf: typeof data?.date === 'string' ? data.date : null,
        confidence: 'medium'
      };
    } catch {
      continue;
    }
  }
  return null;
}

export const staticFallbackRates: Record<string, Record<string, number>> = {
  AED: { AED: 1, EGP: 14.1, SAR: 1.02, QAR: 0.99, KWD: 0.083, MYR: 1.28, MAD: 2.55, EUR: 0.25, USD: 0.2723, GBP: 0.215 },
  USD: { USD: 1, AED: 3.6725, EGP: 48.5, SAR: 3.75, QAR: 3.64, KWD: 0.306, MYR: 4.7, MAD: 9.4, EUR: 0.92, GBP: 0.79 },
  EUR: { EUR: 1, AED: 3.98, EGP: 52.6, SAR: 4.08, QAR: 3.96, KWD: 0.333, MYR: 5.1, MAD: 10.2, USD: 1.09, GBP: 0.86 }
};

export function staticRatesForBase(baseRaw: string): FxProviderResult | null {
  const base = code(baseRaw);
  const direct = staticFallbackRates[base];
  if (direct) return { base, rates: direct, source: 'static-emergency-fallback', sourceAsOf: null, confidence: 'low' };

  for (const [pivot, rates] of Object.entries(staticFallbackRates)) {
    const pivotToBase = Number(rates[base]);
    if (!Number.isFinite(pivotToBase) || pivotToBase <= 0) continue;
    const converted: Record<string, number> = { [base]: 1 };
    for (const [quote, pivotToQuote] of Object.entries(rates)) {
      const value = Number(pivotToQuote) / pivotToBase;
      if (Number.isFinite(value) && value > 0) converted[quote] = value;
    }
    return { base, rates: converted, source: `static-emergency-fallback-via-${pivot}`, sourceAsOf: null, confidence: 'low' };
  }
  return null;
}

export async function fetchProviderChain(base: string) {
  return (await fetchFrankfurterRates(base))
    || (await fetchOpenErRates(base))
    || (await fetchFawazRates(base))
    || staticRatesForBase(base);
}
