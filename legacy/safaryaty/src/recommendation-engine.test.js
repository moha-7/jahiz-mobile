import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRecommendations, RECOMMENDATION_ENGINE_VERSION } from '../shared/recommendation-engine.js';

const base = {
  currency: 'EGP', planned: 10000, available: 12000, paid: 0, remaining: 2000, gap: 0,
  decision: { verdict: 'ALMOST', reasonCode: 'STRENGTHEN_SAFETY_OR_TIMING', inputs: {} },
  categoryAmounts: { 'cat-flight': 4000, 'cat-accommodation': 3500, 'cat-food': 1500, 'cat-transport': 700, 'cat-emergency': 300 },
  categoryRanges: {
    'cat-flight': { low: 3000, typical: 4000, high: 5200 },
    'cat-accommodation': { low: 3000, typical: 4000, high: 5500 },
    'cat-food': { low: 1200, typical: 1800, high: 2400 },
    'cat-transport': { low: 500, typical: 800, high: 1100 },
    'cat-emergency': { low: 600, typical: 900, high: 1200 },
  },
  costProfile: { confidence: 'medium', source: 'country-cost-profile' },
  upcomingPayments: 4,
};

test('recommendation engine version and max-three contract', () => {
  const items = generateRecommendations(base);
  assert.equal(RECOMMENDATION_ENGINE_VERSION, '4.29.42');
  assert.ok(items.length <= 3);
  assert.ok(items.every((item) => item.id && item.reasonCode && item.target && item.actionLabel));
});

test('exchange-rate blocker suppresses dependent advice', () => {
  const items = generateRecommendations({ ...base, rateUnsure: true });
  assert.equal(items.length, 1);
  assert.equal(items[0].reasonCode, 'EXCHANGE_RATE_UNCONFIRMED');
  assert.deepEqual(items[0].target, { tab: 'overview', section: 'display-currency' });
});

test('missing costs blocker suppresses false intelligence', () => {
  const items = generateRecommendations({ ...base, planned: 0, categoryAmounts: {} });
  assert.equal(items.length, 1);
  assert.equal(items[0].reasonCode, 'MISSING_TRIP_COSTS');
});

test('saving gap is ranked before safety and payment tracking', () => {
  const items = generateRecommendations({ ...base, available: 5000, remaining: -5000, gap: 5000, categoryAmounts: { ...base.categoryAmounts, 'cat-shopping': 3000 }, categoryRanges: { ...base.categoryRanges, 'cat-shopping': { low: 500, typical: 1000, high: 1500 } } });
  assert.equal(items[0].reasonCode, 'SAVING_GAP');
  assert.equal(items[0].impact.amount, 5000);
  assert.ok(items.some((item) => item.reasonCode === 'FLEXIBLE_COST_ABOVE_TYPICAL'));
});

test('required category below range is actionable and does not duplicate range advice', () => {
  const items = generateRecommendations({ ...base, categoryAmounts: { ...base.categoryAmounts, 'cat-flight': 0 } });
  const rangeItems = items.filter((item) => ['REQUIRED_COST_BELOW_RANGE', 'FLEXIBLE_COST_ABOVE_TYPICAL'].includes(item.reasonCode));
  assert.equal(rangeItems.length, 1);
  assert.equal(rangeItems[0].categoryId, 'cat-flight');
});

test('emergency recommendation disappears after range is satisfied', () => {
  const missing = generateRecommendations({ ...base, categoryAmounts: { ...base.categoryAmounts, 'cat-emergency': 0 } });
  assert.ok(missing.some((item) => item.reasonCode === 'EMERGENCY_MISSING'));
  const satisfied = generateRecommendations({ ...base, categoryAmounts: { ...base.categoryAmounts, 'cat-emergency': 900 } });
  assert.ok(!satisfied.some((item) => ['EMERGENCY_MISSING', 'EMERGENCY_BELOW_RANGE'].includes(item.reasonCode)));
});

test('ready plan recommends payment tracking instead of conflicting budget changes', () => {
  const items = generateRecommendations({ ...base, decision: { verdict: 'READY', reasonCode: 'READY', inputs: {} }, categoryAmounts: { ...base.categoryAmounts, 'cat-emergency': 900 } });
  assert.equal(items[0].reasonCode, 'UPCOMING_PAYMENTS_EXIST');
});
