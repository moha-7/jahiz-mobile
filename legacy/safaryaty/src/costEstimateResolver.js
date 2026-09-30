import { estimateCategoryCosts, estimateCategoryRanges } from './data/costProfiles.js';
import {
  convertCategoryEstimateMap,
  convertCostRangeProfile,
  normalizeSuggestionRowsCurrency,
  resolveEstimateRate
} from '../shared/cost-estimate-currency.js';

export function resolveLocalCostEstimateBundle(input = {}) {
  const nativeCurrency = String(input.destinationCurrency || input.tripCurrency || 'USD').toUpperCase();
  const targetCurrency = String(input.tripCurrency || nativeCurrency || 'USD').toUpperCase();
  const estimateInput = {
    destinationCountry: input.destinationCountry || '',
    tripCurrency: nativeCurrency,
    costTier: input.costTier || 'medium',
    comfortLevel: input.comfortLevel || 'Balanced',
    days: Math.max(1, Number(input.days || 7)),
    travelers: Math.max(1, Number(input.travelers || 1))
  };
  const nativeCategories = estimateCategoryCosts(estimateInput);
  const nativeRanges = estimateCategoryRanges(estimateInput);
  const rate = resolveEstimateRate(input.rateBook || {}, nativeCurrency, targetCurrency);

  if (nativeCurrency === targetCurrency) {
    return {
      nativeCurrency,
      targetCurrency,
      rate: 1,
      conversionAvailable: true,
      categories: convertCategoryEstimateMap(nativeCategories, { sourceCurrency: nativeCurrency, targetCurrency, rate: 1 }),
      ranges: convertCostRangeProfile(nativeRanges, { sourceCurrency: nativeCurrency, targetCurrency, rate: 1 })
    };
  }

  if (!rate) {
    return {
      nativeCurrency,
      targetCurrency,
      rate: 0,
      conversionAvailable: false,
      categories: null,
      ranges: null,
      nativeCategories,
      nativeRanges
    };
  }

  return {
    nativeCurrency,
    targetCurrency,
    rate,
    conversionAvailable: true,
    categories: convertCategoryEstimateMap(nativeCategories, { sourceCurrency: nativeCurrency, targetCurrency, rate }),
    ranges: convertCostRangeProfile(nativeRanges, { sourceCurrency: nativeCurrency, targetCurrency, rate })
  };
}

export function normalizeBackendRangeProfile(profile, tripCurrency, rateBook = {}) {
  if (!profile?.categories) return null;
  const sourceCurrency = String(profile.currency || profile.nativeCurrency || tripCurrency || '').toUpperCase();
  const targetCurrency = String(tripCurrency || sourceCurrency || '').toUpperCase();
  if (!sourceCurrency || !targetCurrency) return null;
  if (sourceCurrency === targetCurrency) return { ...profile, currency: targetCurrency, conversionAvailable: true };
  const rate = resolveEstimateRate(rateBook, sourceCurrency, targetCurrency);
  if (!rate) return null;
  return convertCostRangeProfile(profile, { sourceCurrency, targetCurrency, rate });
}

export function normalizeBackendSuggestions(rows, tripCurrency, rateBook = {}) {
  return normalizeSuggestionRowsCurrency(rows || [], { targetCurrency: tripCurrency, rateBook });
}
