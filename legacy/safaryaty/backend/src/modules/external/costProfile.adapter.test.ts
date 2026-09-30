import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateCategoryRanges } from '../suggestions/cost-profiles.js';

test('cost profile ranges return Low Typical High values', () => {
  const data = estimateCategoryRanges({
    destinationCountry: 'EG',
    tripCurrency: 'EGP',
    comfortLevel: 'Balanced',
    days: 10,
    travelers: 2
  });
  const food: any = data.categories['cat-food'];
  assert.equal(data.currency, 'EGP');
  assert.ok(food.low < food.typical);
  assert.ok(food.typical < food.high);
  assert.equal(food.unit, 'per traveler / day');
  assert.equal(data.confidence, 'medium');
});
