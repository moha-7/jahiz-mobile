import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const screen = fs.readFileSync(
  'apps/mobile/src/features/create-trip/commitments-screen.tsx',
  'utf8',
);

const card = fs.readFileSync(
  'apps/mobile/src/features/create-trip/commitment-recurring-plan-card.tsx',
  'utf8',
);

test(
  'commitment add menu exposes monthly as a third distinct product type',
  () => {
    assert.match(
      screen,
      /key: 'one-time'/,
    );

    assert.match(
      screen,
      /key: 'installments'/,
    );

    assert.match(
      screen,
      /key: 'monthly'/,
    );

    assert.match(
      screen,
      /monthlyCommitmentOption/,
    );
  },
);

test(
  'monthly screen wiring creates and edits recurring definitions rather than installment rows',
  () => {
    assert.match(
      screen,
      /state\.addRecurringCommitment/,
    );

    assert.match(
      screen,
      /state\.updateRecurringCommitment/,
    );

    assert.match(
      screen,
      /saveRecurringCommitment/,
    );

    assert.match(
      screen,
      /CommitmentRecurringModal/,
    );
  },
);

test(
  'one recurring definition renders as one monthly plan card',
  () => {
    assert.match(
      screen,
      /workspace\s*\.recurringCommitments/,
    );

    assert.match(
      screen,
      /recurringCommitments\s*\.map/,
    );

    assert.match(
      screen,
      /CommitmentRecurringPlanCard/,
    );
  },
);

test(
  'commitment summary consumes recurring-aware paid-pending selector',
  () => {
    assert.match(
      screen,
      /selectPaidPendingCountedCommitmentsTotal\(\s*workspace/,
    );

    assert.doesNotMatch(
      screen,
      /workspace\.commitments\s*\.filter\(\s*\(item\)\s*=>\s*item\.status ===\s*'paid'/,
    );
  },
);

test(
  'monthly plan deletion is not exposed before occurrence-history UX is designed',
  () => {
    assert.doesNotMatch(
      screen,
      /removeRecurringCommitment/,
    );

    assert.doesNotMatch(
      screen,
      /onDelete=/,
    );
  },
);

test(
  'trip-window card never falls back to an after-return due date when preview is known',
  () => {
    assert.match(
      card,
      /preview\s*\?\s*preview\.nextUnpaidDate/,
    );

    assert.doesNotMatch(
      card,
      /preview\s*\?\.nextUnpaidDate\s*\?\?/,
    );
  },
);
