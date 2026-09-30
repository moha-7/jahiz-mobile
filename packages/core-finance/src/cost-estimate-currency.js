import { normalizeCurrencyCode, normalizeRate, rateFromBook } from './currency-domain.js';

const ZERO_DECIMAL_ESTIMATE_CURRENCIES = new Set(['JPY','KRW','VND','IDR','EGP','THB','TRY']);

export function roundPlanningEstimate(valueRaw, currencyRaw = 'USD') {
  const value = Math.max(0, Number(valueRaw) || 0);
  const currency = normalizeCurrencyCode(currencyRaw, 'USD') || 'USD';
  const zeroDecimal = ZERO_DECIMAL_ESTIMATE_CURRENCIES.has(currency);
  const step = zeroDecimal
    ? (value > 100000 ? 1000 : value > 10000 ? 500 : 100)
    : (value > 1000 ? 50 : 10);
  return Math.max(step, Math.round(value / step) * step);
}

export function resolveEstimateRate(rateBook = {}, sourceRaw, targetRaw) {
  const sourceCurrency = normalizeCurrencyCode(sourceRaw);
  const targetCurrency = normalizeCurrencyCode(targetRaw);
  if (!sourceCurrency || !targetCurrency) return 0;
  if (sourceCurrency === targetCurrency) return 1;
  return rateFromBook(rateBook || {}, sourceCurrency, targetCurrency);
}

export function convertCategoryEstimateMap(estimate = {}, input = {}) {
  const sourceCurrency = normalizeCurrencyCode(input.sourceCurrency || estimate?._meta?.profileCurrency || estimate?._meta?.currency);
  const targetCurrency = normalizeCurrencyCode(input.targetCurrency);
  const rate = sourceCurrency === targetCurrency ? 1 : normalizeRate(input.rate);
  if (!sourceCurrency || !targetCurrency || !rate) return null;

  const converted = {};
  for (const [key, value] of Object.entries(estimate || {})) {
    if (key.startsWith('_')) continue;
    converted[key] = roundPlanningEstimate(Number(value || 0) * rate, targetCurrency);
  }
  converted._meta = {
    ...(estimate?._meta || {}),
    profileCurrency: targetCurrency,
    nativeCurrency: sourceCurrency,
    requestedCurrency: targetCurrency,
    conversionAvailable: true,
    converted: sourceCurrency !== targetCurrency,
    conversionRate: rate,
    source: sourceCurrency === targetCurrency
      ? (estimate?._meta?.source || input.source || 'cost-profile')
      : `${estimate?._meta?.source || input.source || 'cost-profile'}+fx`
  };
  return converted;
}

export function convertCostRangeProfile(profile = {}, input = {}) {
  const sourceCurrency = normalizeCurrencyCode(input.sourceCurrency || profile.currency || profile.nativeCurrency);
  const targetCurrency = normalizeCurrencyCode(input.targetCurrency);
  const rate = sourceCurrency === targetCurrency ? 1 : normalizeRate(input.rate);
  if (!sourceCurrency || !targetCurrency || !rate) return null;

  const categories = Object.fromEntries(Object.entries(profile.categories || {}).map(([key, item]) => [key, {
    ...item,
    low: roundPlanningEstimate(Number(item?.low || 0) * rate, targetCurrency),
    typical: roundPlanningEstimate(Number(item?.typical || 0) * rate, targetCurrency),
    high: roundPlanningEstimate(Number(item?.high || 0) * rate, targetCurrency)
  }]));
  return {
    ...profile,
    currency: targetCurrency,
    nativeCurrency: sourceCurrency,
    requestedCurrency: targetCurrency,
    conversionAvailable: true,
    converted: sourceCurrency !== targetCurrency,
    conversionRate: rate,
    categories,
    totals: {
      low: roundPlanningEstimate(Number(profile.totals?.low || 0) * rate, targetCurrency),
      typical: roundPlanningEstimate(Number(profile.totals?.typical || 0) * rate, targetCurrency),
      high: roundPlanningEstimate(Number(profile.totals?.high || 0) * rate, targetCurrency)
    }
  };
}

export function normalizeSuggestionRowsCurrency(rows = [], input = {}) {
  const targetCurrency = normalizeCurrencyCode(input.targetCurrency);
  const rateBook = input.rateBook || {};
  if (!targetCurrency) return [];
  const normalized = [];
  for (const row of rows || []) {
    const sourceCurrency = normalizeCurrencyCode(row?.currency || targetCurrency, targetCurrency);
    if (sourceCurrency === targetCurrency) {
      normalized.push({ ...row, currency: targetCurrency });
      continue;
    }
    const rate = resolveEstimateRate(rateBook, sourceCurrency, targetCurrency);
    if (!rate) continue;
    normalized.push({
      ...row,
      currency: targetCurrency,
      currentAmount: roundPlanningEstimate(Number(row.currentAmount || 0) * rate, targetCurrency),
      suggestedAmount: roundPlanningEstimate(Number(row.suggestedAmount || 0) * rate, targetCurrency),
      difference: roundPlanningEstimate(Math.abs(Number(row.difference || 0)) * rate, targetCurrency) * (Number(row.difference || 0) < 0 ? -1 : 1),
      convertedFromCurrency: sourceCurrency,
      conversionRate: rate
    });
  }
  return normalized;
}
