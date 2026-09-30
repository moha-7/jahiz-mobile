import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  calculateTodayFinancialCoverage,
  calculateTodayReadinessPreview,
} from '../apps/mobile/src/features/today/today-readiness-preview.ts';

const todaySource = fs.readFileSync(
  new URL(
    '../apps/mobile/src/features/today/today-screen.tsx',
    import.meta.url,
  ),
  'utf8',
);

test('Today financial coverage preserves the no-payment baseline', () => {
  assert.equal(
    calculateTodayFinancialCoverage({
      totalCost: 3000,
      remainingTotal: 3000,
      readyMoney: 1500,
    }),
    50,
  );
});

test('Today financial coverage uses remaining unpaid cost after partial payment', () => {
  assert.equal(
    calculateTodayFinancialCoverage({
      totalCost: 3000,
      remainingTotal: 2000,
      readyMoney: 1500,
    }),
    75,
  );
});

test('fully paid trip has complete financial coverage even with zero current Ready Money', () => {
  assert.equal(
    calculateTodayFinancialCoverage({
      totalCost: 3000,
      remainingTotal: 0,
      readyMoney: 0,
    }),
    100,
  );
});

test('no planned trip costs preserve the deliberate neutral coverage state', () => {
  assert.equal(
    calculateTodayFinancialCoverage({
      totalCost: 0,
      remainingTotal: 0,
      readyMoney: 1000,
    }),
    0,
  );
});

test('negative Ready Money never becomes positive financial coverage', () => {
  assert.equal(
    calculateTodayFinancialCoverage({
      totalCost: 3000,
      remainingTotal: 2000,
      readyMoney: -500,
    }),
    0,
  );
});

test('corrected financial coverage flows into the existing readiness score without changing weights', () => {
  const partial = calculateTodayReadinessPreview({
    setupProgress: 100,
    financialCoverage: 75,
    commitmentsReviewed: true,
    paymentPlanCoverage: 100,
  });
  const fullyPaid = calculateTodayReadinessPreview({
    setupProgress: 100,
    financialCoverage: 100,
    commitmentsReviewed: true,
    paymentPlanCoverage: 100,
  });

  assert.equal(partial.score, 90);
  assert.equal(partial.components.financialCoverage, 30);
  assert.equal(fullyPaid.score, 100);
});

test('Today consumes total, remaining and Ready Money through the shared coverage helper', () => {
  assert.match(
    todaySource,
    /calculateTodayFinancialCoverage\(\{[\s\S]*?totalCost:\s*summary\.totalCost,[\s\S]*?remainingTotal:\s*summary\.remainingTotal,[\s\S]*?readyMoney:\s*summary\.readyMoney,[\s\S]*?\}\)/,
  );

  assert.doesNotMatch(
    todaySource,
    /summary\.readyMoney[\s\S]{0,120}summary\.totalCost\)\s*\*\s*100/,
  );
});
