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

const impactModal = fs.readFileSync(
  'apps/mobile/src/features/create-trip/commitment-recurring-impact-modal.tsx',
  'utf8',
);

test(
  'monthly Mark as paid delegates the exact occurrence to the recurring lifecycle store',
  () => {
    assert.match(
      screen,
      /state\s*\.markRecurringCommitmentOccurrencePaid/,
    );

    assert.match(
      screen,
      /markRecurringCommitmentOccurrencePaid\(\s*item\.id,\s*dueDate/,
    );

    assert.match(
      screen,
      /onMarkOccurrencePaid=\{\s*markMonthlyOccurrencePaid/,
    );
  },
);

test(
  'marking monthly occurrence paid remains conservative and does not infer Money reflection',
  () => {
    const match =
      screen.match(
        /function markMonthlyOccurrencePaid[\s\S]*?function reviewMonthlyOccurrenceImpact/,
      );

    assert.ok(match);

    assert.doesNotMatch(
      match[0],
      /setRecurringCommitmentOccurrenceMoneyReflected/,
    );

    assert.doesNotMatch(
      match[0],
      /setRecurringPaidImpactTarget/,
    );
  },
);

test(
  'payment-impact review stores exact series id and due date rather than a stale plan copy',
  () => {
    assert.match(
      screen,
      /setRecurringPaidImpactTarget\(\{\s*id: item\.id,\s*dueDate,/,
    );

    assert.match(
      screen,
      /recurringPaidImpactPlan/,
    );

    assert.match(
      screen,
      /recurringPaidImpactOccurrence/,
    );
  },
);

test(
  'Money reflection is an explicit reversible occurrence action',
  () => {
    assert.match(
      screen,
      /state\s*\.setRecurringCommitmentOccurrenceMoneyReflected/,
    );

    assert.match(
      screen,
      /setRecurringCommitmentOccurrenceMoneyReflected\([\s\S]*?reflected,/,
    );

    assert.match(
      impactModal,
      /onSetReflected\(\s*false/,
    );

    assert.match(
      impactModal,
      /onSetReflected\(\s*true/,
    );
  },
);

test(
  'undo targets only the exact recurring occurrence and never applies installment sequence rules',
  () => {
    assert.match(
      screen,
      /state\s*\.markRecurringCommitmentOccurrenceUnpaid/,
    );

    assert.match(
      screen,
      /markRecurringCommitmentOccurrenceUnpaid\([\s\S]*?recurringPaidImpactTarget[\s\S]*?dueDate/,
    );

    assert.doesNotMatch(
      screen,
      /isCommitmentInstallmentStatusTransitionAllowed\([\s\S]{0,300}recurringPaidImpactTarget/,
    );
  },
);

test(
  'impact modal keeps Not yet and Yes choices visually neutral and owns no financial store',
  () => {
    assert.match(
      impactModal,
      /commitmentPaidKeepDeducted/,
    );

    assert.match(
      impactModal,
      /commitmentPaidMoneyUpdated/,
    );

    assert.match(
      impactModal,
      /commitmentPaidUndoPayment/,
    );

    assert.doesNotMatch(
      impactModal,
      /useTripWorkspaceStore/,
    );

    assert.doesNotMatch(
      impactModal,
      /Ready Money[\s\S]*[+\-*\/]/,
    );
  },
);

test(
  'monthly card remains presentation-only and delegates occurrence mutations upward',
  () => {
    assert.match(
      card,
      /onMarkOccurrencePaid\?/,
    );

    assert.match(
      card,
      /onReviewOccurrenceImpact\?/,
    );

    assert.doesNotMatch(
      card,
      /useTripWorkspaceStore/,
    );
  },
);
