import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const selectors = fs.readFileSync(
  'apps/mobile/src/features/trip-workspace/trip-workspace-selectors.ts',
  'utf8',
);

const decision = fs.readFileSync(
  'apps/mobile/src/features/moves/jahiz-decision-context.ts',
  'utf8',
);

test(
  'recurring commitments have one bounded occurrence read model',
  () => {
    assert.match(
      selectors,
      /export function selectRecurringCommitmentOccurrencesThrough\(/,
    );

    assert.match(
      selectors,
      /expandMonthlyDates\(/,
    );
  },
);

test(
  'Next due combines regular and recurring obligations without flattening domains',
  () => {
    assert.match(
      selectors,
      /sourceKind: 'regular'/,
    );

    assert.match(
      selectors,
      /sourceKind:\s*'recurring'/,
    );

    assert.match(
      selectors,
      /selectNextTripWindowCommitmentGroup/,
    );
  },
);

test(
  'overdue decision consumes the shared commitment read model',
  () => {
    assert.match(
      decision,
      /selectOverdueCommitmentDueItem/,
    );

    assert.match(
      decision,
      /selectOverdueCommitmentDueItem\(\s*workspace,\s*todayIso/,
    );

    assert.doesNotMatch(
      decision,
      /const overdueCommitment =\s*workspace\.commitments/,
    );
  },
);

test(
  'open-ended recurring commitments expose bounded totals',
  () => {
    assert.match(
      selectors,
      /selectTripWindowUnpaidCommitmentsTotal/,
    );

    assert.match(
      selectors,
      /selectPaidPendingCountedCommitmentsTotal/,
    );
  },
);
