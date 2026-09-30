import assert from 'node:assert/strict';
import test from 'node:test';
import {
  messages,
  translate,
  type MessageKey,
} from '../packages/i18n/src/index.ts';

const criticalKeys = [
  'todayRouteDates',
  'todayChipInProgress',
  'todayMoveOverdueHelper',
  'todayMoveFundingGap',
  'todayMoveBookingsLeft',
  'movesUsefulHelper',
  'movesOverdueCommitmentHelper',
  'movesOverduePaymentHelper',
  'movesFundingGapTitle',
  'movesBookingsTitle',
  'movesPlanIncompleteHelper',
  'movesSpendingHelper',
  'todayDayProgressValue',
] as const satisfies readonly MessageKey[];

function placeholders(value: string): string[] {
  return Array.from(
    value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g),
    (match) => match[1],
  ).sort();
}

test('critical copy never uses doubled interpolation braces', () => {
  for (const locale of ['en', 'ar'] as const) {
    for (const key of criticalKeys) {
      const value = messages[locale][key];
      assert.equal(
        value.includes('{{') || value.includes('}}'),
        false,
        `${locale}.${key} contains doubled braces`,
      );
    }
  }
});

test('critical EN and AR copy keep the same interpolation contract', () => {
  for (const key of criticalKeys) {
    assert.deepEqual(
      placeholders(messages.en[key]),
      placeholders(messages.ar[key]),
      `placeholder mismatch for ${key}`,
    );
  }
});

test('runtime interpolation removes all critical placeholders', () => {
  const rendered = [
    translate('en', 'movesUsefulHelper', {
      count: 2,
    }),
    translate('ar', 'movesUsefulHelper', {
      count: 2,
    }),
    translate('en', 'movesOverdueCommitmentHelper', {
      title: 'Tabby',
      amount: '625 AED',
      date: '2026-08-14',
    }),
    translate('ar', 'movesOverdueCommitmentHelper', {
      title: 'Tabby',
      amount: '625 AED',
      date: '2026-08-14',
    }),
    translate('ar', 'todayDayProgressValue', {
      day: 8,
      count: 8,
    }),
  ];

  for (const value of rendered) {
    assert.equal(
      /\{[A-Za-z][A-Za-z0-9_]*\}/.test(value),
      false,
      `unresolved placeholder: ${value}`,
    );
  }
});

test('primary Arabic product copy is not Egyptian-dialect dependent', () => {
  const keys = [
    'appTagline',
    'movesTagline',
    'todayYourNextMove',
    'fundsStepTitle',
  ] as const satisfies readonly MessageKey[];

  const egyptianOnly = /(?:إيه|دلوقتي|الفلوس)/;

  for (const key of keys) {
    assert.equal(
      egyptianOnly.test(messages.ar[key]),
      false,
      `Egyptian-only wording remains in ar.${key}`,
    );
  }
});
