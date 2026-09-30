import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertCategoryEstimateMap,
  convertCostRangeProfile,
  normalizeSuggestionRowsCurrency,
  resolveEstimateRate
} from '../shared/cost-estimate-currency.js';
import { resolveLocalCostEstimateBundle, normalizeBackendRangeProfile } from './costEstimateResolver.js';

const rateBook = { BHD_AED: 9.78, AED_BHD: 1 / 9.78 };

test('destination estimate value changes numerically when trip currency changes', () => {
  const profile = {
    currency: 'BHD',
    categories: { 'cat-food': { low: 80, typical: 100, high: 130, unit: 'per traveler / day' } },
    totals: { low: 680, typical: 870, high: 1150 },
    confidence: 'low',
    source: 'tier-cost-profile'
  };
  const converted = convertCostRangeProfile(profile, { sourceCurrency: 'BHD', targetCurrency: 'AED', rate: 9.78 });
  assert.equal(converted.currency, 'AED');
  assert.notEqual(converted.totals.typical, 870);
  assert.equal(converted.totals.typical, 8500);
  assert.equal(converted.nativeCurrency, 'BHD');
});

test('local estimate resolver converts one native profile instead of relabelling it', () => {
  const bhd = resolveLocalCostEstimateBundle({
    destinationCountry: 'BH',
    destinationCurrency: 'BHD',
    tripCurrency: 'BHD',
    rateBook,
    costTier: 'medium-high',
    days: 7,
    travelers: 1,
    comfortLevel: 'Balanced'
  });
  const aed = resolveLocalCostEstimateBundle({
    destinationCountry: 'BH',
    destinationCurrency: 'BHD',
    tripCurrency: 'AED',
    rateBook,
    costTier: 'medium-high',
    days: 7,
    travelers: 1,
    comfortLevel: 'Balanced'
  });
  assert.equal(bhd.ranges.currency, 'BHD');
  assert.equal(aed.ranges.currency, 'AED');
  assert.equal(aed.ranges.nativeCurrency, 'BHD');
  assert.notEqual(aed.ranges.totals.typical, bhd.ranges.totals.typical);
  const ratio = aed.ranges.totals.typical / bhd.ranges.totals.typical;
  assert.ok(ratio > 9 && ratio < 10.5);
});

test('missing rate never relabels native estimates as the requested currency', () => {
  const result = resolveLocalCostEstimateBundle({
    destinationCountry: 'BH',
    destinationCurrency: 'BHD',
    tripCurrency: 'AED',
    rateBook: {},
    costTier: 'medium-high',
    days: 7,
    travelers: 1
  });
  assert.equal(result.conversionAvailable, false);
  assert.equal(result.categories, null);
  assert.equal(result.ranges, null);
  assert.equal(result.nativeRanges.currency, 'BHD');
});

test('stale backend suggestion rows are converted defensively before display', () => {
  const rows = normalizeSuggestionRowsCurrency([
    { categoryId: 'cat-food', currency: 'BHD', currentAmount: 0, suggestedAmount: 100, difference: 100 }
  ], { targetCurrency: 'AED', rateBook });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].currency, 'AED');
  assert.equal(rows[0].suggestedAmount, 980);
});

test('backend profile normalization rejects an unconvertible currency instead of relabelling', () => {
  const profile = { currency: 'BHD', categories: { 'cat-food': { low: 80, typical: 100, high: 130 } }, totals: { low: 80, typical: 100, high: 130 } };
  assert.equal(normalizeBackendRangeProfile(profile, 'AED', {}), null);
  const converted = normalizeBackendRangeProfile(profile, 'AED', rateBook);
  assert.equal(converted.currency, 'AED');
  assert.equal(converted.categories['cat-food'].typical, 980);
});

test('rate resolver reads direct and inverse trip rates', () => {
  assert.equal(resolveEstimateRate(rateBook, 'BHD', 'AED'), 9.78);
  assert.ok(Math.abs(resolveEstimateRate(rateBook, 'AED', 'BHD') - (1 / 9.78)) < 1e-12);
});
