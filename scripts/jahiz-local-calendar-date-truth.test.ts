import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  localCalendarIso,
} from '../apps/mobile/src/features/trip-workspace/jahiz-local-date.ts';

const helperSource = fs.readFileSync(
  new URL(
    '../apps/mobile/src/features/trip-workspace/jahiz-local-date.ts',
    import.meta.url,
  ),
  'utf8',
);

const selectorSource = fs.readFileSync(
  new URL(
    '../apps/mobile/src/features/trip-workspace/trip-workspace-selectors.ts',
    import.meta.url,
  ),
  'utf8',
);

const tripsSource = fs.readFileSync(
  new URL(
    '../apps/mobile/src/features/trips/trips-screen.tsx',
    import.meta.url,
  ),
  'utf8',
);

test('local calendar helper follows the UAE calendar day across UTC midnight drift', () => {
  const previousTz = process.env.TZ;

  try {
    process.env.TZ = 'Asia/Dubai';

    const instant = new Date(
      '2026-09-03T20:30:00.000Z',
    );

    assert.equal(
      instant.toISOString().slice(0, 10),
      '2026-09-03',
    );
    assert.equal(
      localCalendarIso(instant),
      '2026-09-04',
    );
  } finally {
    if (previousTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previousTz;
    }
  }
});

test('local calendar helper never derives today from UTC serialization', () => {
  assert.match(helperSource, /getFullYear\(\)/);
  assert.match(helperSource, /getMonth\(\)/);
  assert.match(helperSource, /getDate\(\)/);
  assert.doesNotMatch(
    helperSource,
    /toISOString|getUTCFullYear|getUTCMonth|getUTCDate/,
  );
});

test('overdue commitment and payment status share local calendar truth', () => {
  assert.match(
    selectorSource,
    /import \{ localCalendarIso \} from '\.\/jahiz-local-date';/,
  );

  const uses =
    selectorSource.match(
      /const today\s*=\s*localCalendarIso\(\);/g,
    ) ?? [];

  assert.equal(uses.length, 2);
  assert.doesNotMatch(
    selectorSource,
    /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/,
  );
});

test('Trips lifecycle uses the same local calendar date contract', () => {
  assert.match(
    tripsSource,
    /localCalendarIso/,
  );
  assert.match(
    tripsSource,
    /const todayIso = localCalendarIso\(\);/,
  );
  assert.doesNotMatch(
    tripsSource,
    /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/,
  );
});
