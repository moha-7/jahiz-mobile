import assert from 'node:assert/strict';
import test from 'node:test';

import {
  translate,
} from '../packages/i18n/src/index.ts';

test('English count nouns use singular wording for exactly one', () => {
  const cases: Array<{
    key: Parameters<typeof translate>[1];
    values: Record<string, string | number>;
    expected: string;
  }> = [
    {
      key: 'movesUsefulHelper',
      values: { count: 1 },
      expected: 'Showing 1 action that matters most right now.',
    },
    {
      key: 'activeTripSummary',
      values: {
        destination: 'Cairo',
        count: 1,
      },
      expected: 'Cairo · 1 day',
    },
    {
      key: 'tripDays',
      values: { count: 1 },
      expected: '1 day',
    },
    {
      key: 'planCommitmentsSummary',
      values: { count: 1 },
      expected: '1 obligation',
    },
    {
      key: 'categoryItemsSummary',
      values: {
        amount: '500 AED',
        count: 1,
      },
      expected: '500 AED total · 1 estimate',
    },
    {
      key: 'costItemsCount',
      values: { count: 1 },
      expected: '1 cost item',
    },
    {
      key: 'commitmentItemsCount',
      values: { count: 1 },
      expected: '1 commitment item',
    },
    {
      key: 'paymentInDays',
      values: { days: 1 },
      expected: 'In 1 day',
    },
  ];

  for (const item of cases) {
    assert.equal(
      translate(
        'en',
        item.key,
        item.values,
      ),
      item.expected,
    );
  }
});

test('English count nouns keep plural wording for zero and multiple values', () => {
  assert.equal(
    translate(
      'en',
      'movesUsefulHelper',
      { count: 0 },
    ),
    'Showing 0 actions that matter most right now.',
  );

  assert.equal(
    translate(
      'en',
      'tripDays',
      { count: 8 },
    ),
    '8 days',
  );

  assert.equal(
    translate(
      'en',
      'categoryItemsSummary',
      {
        amount: '2,000 AED',
        count: 2,
      },
    ),
    '2,000 AED total · 2 estimates',
  );

  assert.equal(
    translate(
      'en',
      'costSummaryCounts',
      {
        items: 1,
        estimated: 1,
        confirmed: 0,
      },
    ),
    '1 item · 1 planned · 0 confirmed',
  );

  assert.equal(
    translate(
      'en',
      'costSummaryCounts',
      {
        items: 5,
        estimated: 5,
        confirmed: 0,
      },
    ),
    '5 items · 5 planned · 0 confirmed',
  );
});

test('installment and commitment summaries pluralize without changing numeric truth', () => {
  assert.equal(
    translate(
      'en',
      'commitmentInstallmentPreview',
      {
        count: 1,
        amount: '625 AED',
      },
    ),
    '1 installment · about 625 AED each',
  );

  assert.equal(
    translate(
      'en',
      'commitmentInstallmentPreview',
      {
        count: 4,
        amount: '625 AED',
      },
    ),
    '4 installments · about 625 AED each',
  );

  assert.equal(
    translate(
      'en',
      'commitmentsSummary',
      {
        count: 1,
        amount: '625 AED',
      },
    ),
    '1 item · 625 AED unpaid total',
  );

  assert.equal(
    translate(
      'en',
      'planCostsSummary',
      {
        bookings: 1,
        spending: 2,
      },
    ),
    '1 booking · 2 spending',
  );
});

test('Arabic copy remains unchanged by English plural token adoption', () => {
  assert.equal(
    translate(
      'ar',
      'tripDays',
      { count: 1 },
    ),
    '1 أيام',
  );

  assert.equal(
    translate(
      'ar',
      'movesUsefulHelper',
      { count: 1 },
    ),
    'يعرض جاهز 1 من أهم الخطوات الآن.',
  );
});

test('plural tokens never leak braces into rendered English copy', () => {
  const rendered = [
    translate(
      'en',
      'tripDays',
      { count: 1 },
    ),
    translate(
      'en',
      'movesUsefulHelper',
      { count: 3 },
    ),
    translate(
      'en',
      'costSummaryCounts',
      {
        items: 1,
        estimated: 1,
        confirmed: 0,
      },
    ),
    translate(
      'en',
      'paymentInDays',
      { days: 1 },
    ),
  ];

  for (const value of rendered) {
    assert.equal(
      value.includes('{'),
      false,
    );
    assert.equal(
      value.includes('}'),
      false,
    );
  }
});
