import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function source(path) {
  return fs.readFileSync(
    new URL(path, import.meta.url),
    'utf8',
  );
}

const contracts = source(
  '../packages/api-contracts/src/index.ts',
);
const selectors = source(
  '../apps/mobile/src/features/trip-workspace/trip-workspace-selectors.ts',
);
const store = source(
  '../apps/mobile/src/features/trip-workspace/trip-workspace-store.ts',
);
const costs = source(
  '../apps/mobile/src/features/create-trip/costs-screen.tsx',
);
const plan = source(
  '../apps/mobile/src/features/plan/plan-screen.tsx',
);
const i18n = source(
  '../packages/i18n/src/index.ts',
);

test(
  'cost review is backward-compatible state and missing review never completes Costs',
  () => {
    assert.match(
      contracts,
      /costsReviewed:\s*z\.boolean\(\)\.optional\(\)/,
    );

    assert.match(
      selectors,
      /const costsComplete =[\s\S]*?workspace\.costsReviewed === true[\s\S]*?workspace\.costItems\.length > 0/,
    );

    assert.match(
      plan,
      /const hasCosts =[\s\S]*?workspace\.costsReviewed === true[\s\S]*?workspace\.costItems\.length > 0/,
    );
  },
);

test(
  'cost edits invalidate review until the user explicitly continues again',
  () => {
    const invalidations =
      store.match(
        /costsReviewed:\s*false/g,
      ) ?? [];

    assert.ok(
      invalidations.length >= 6,
      'initial state, route/date changes and add/update/remove must remain unreviewed',
    );

    assert.match(
      store,
      /setRoute:[\s\S]*?costsReviewed:\s*false/,
    );

    assert.match(
      store,
      /setDates:[\s\S]*?costsReviewed:\s*false/,
    );

    assert.match(
      store,
      /markCostsReviewed:[\s\S]*?costsReviewed:\s*reviewed/,
    );
  },
);

test(
  'Costs Continue confirms review before choosing the next funnel action while Save and exit does not',
  () => {
    assert.match(
      costs,
      /function handleContinue\(\)[\s\S]*?markCostsReviewed\(true\)[\s\S]*?bookingPaymentSetupNeeded[\s\S]*?'\/payments'[\s\S]*?'\/'/,
    );

    const saveAndExit =
      /function handleSaveAndExit\(\)\s*\{([\s\S]*?)\n  \}/.exec(
        costs,
      )?.[1] ?? '';

    assert.doesNotMatch(
      saveAndExit,
      /markCostsReviewed/,
    );

    assert.match(
      saveAndExit,
      /router\.replace\('\/plan'\)/,
    );
  },
);

test(
  'cost copy states that missing costs are not counted instead of treating them as zero',
  () => {
    assert.match(
      i18n,
      /costReviewTruthHelper: 'Missing costs are not counted\./,
    );

    assert.match(
      i18n,
      /costReviewTruthHelper: 'أي تكلفة ناقصة مش بتتحسب\./,
    );

    assert.match(
      i18n,
      /nextStepCosts: 'Review the costs you expect for this trip\.'/,
    );

    assert.match(
      i18n,
      /nextStepCosts: 'راجع التكاليف اللي متوقعها للرحلة\.'/,
    );

    assert.match(
      costs,
      /t\('costReviewTruthHelper'\)/,
    );
  },
);
