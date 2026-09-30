import assert from 'node:assert/strict';
import test from 'node:test';

import {
  messages,
  translate,
} from '../packages/i18n/src/index.ts';

test('named interpolation consumes the complete token including closing brace', () => {
  assert.equal(
    translate(
      'en',
      'tripDays',
      {
        count: 8,
      },
    ),
    '8 days',
  );

  assert.equal(
    translate(
      'en',
      'activeTripSummary',
      {
        destination: 'Cairo',
        count: 8,
      },
    ),
    'Cairo · 8 days',
  );

  const costSummary =
    translate(
      'en',
      'costSummaryCounts',
      {
        items: 5,
        estimated: 5,
        confirmed: 0,
      },
    );

  const expectedCostSummary =
    messages.en.costSummaryCounts
      .replace(
        '[[plural:items|item|items]]',
        'items',
      )
      .replaceAll(
        '{items}',
        '5',
      )
      .replaceAll(
        '{estimated}',
        '5',
      )
      .replaceAll(
        '{confirmed}',
        '0',
      );

  assert.equal(
    costSummary,
    expectedCostSummary,
  );
});

test('interpolation regression is independent of planned/estimated wording', () => {
  const rendered =
    translate(
      'en',
      'costSummaryCounts',
      {
        items: 2,
        estimated: 1,
        confirmed: 1,
      },
    );

  assert.equal(
    rendered.includes('{'),
    false,
  );

  assert.equal(
    rendered.includes('}'),
    false,
  );

  assert.ok(
    rendered.includes('2'),
  );

  assert.ok(
    rendered.includes('1'),
  );
});

test('interpolation handles amount, name, date and count without dangling braces', () => {
  const samples = [
    translate(
      'en',
      'saveBeforeTravel',
      {
        amount: '625 AED',
      },
    ),
    translate(
      'en',
      'dueDateShort',
      {
        date: '2026-08-25',
      },
    ),
    translate(
      'en',
      'activeTripSummary',
      {
        destination: 'DXB → CAI',
        count: 8,
      },
    ),
  ];

  for (const sample of samples) {
    assert.equal(
      sample.includes('{'),
      false,
    );

    assert.equal(
      sample.includes('}'),
      false,
    );
  }
});

test('every declared message placeholder can be fully consumed', () => {
  for (const locale of [
    'en',
    'ar',
  ] as const) {
    for (const [
      key,
      message,
    ] of Object.entries(
      messages[locale],
    )) {
      const placeholders =
        Array.from(
          message.matchAll(
            /\{([A-Za-z0-9_]+)\}/g,
          ),
        );

      if (
        placeholders.length ===
        0
      ) {
        continue;
      }

      const values:
        Record<
          string,
          string
        > = {};

      for (const match of placeholders) {
        const name =
          match[1];

        values[name] =
          `VALUE_${name}`;
      }

      const rendered =
        translate(
          locale,
          key as keyof typeof messages.en,
          values,
        );

      assert.equal(
        /\{[A-Za-z0-9_]+\}/.test(
          rendered,
        ),
        false,
        `${locale}.${key} still contains an interpolation token: ${rendered}`,
      );

      assert.equal(
        rendered.includes('}'),
        false,
        `${locale}.${key} contains a dangling closing brace: ${rendered}`,
      );
    }
  }
});

test('unknown braces are not introduced by interpolation itself', () => {
  const rendered =
    translate(
      'en',
      'needMore',
      {
        amount: 1234,
      },
    );

  assert.equal(
    rendered,
    'You need 1234 more',
  );
});
