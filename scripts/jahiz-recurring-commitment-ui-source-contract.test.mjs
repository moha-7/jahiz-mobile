import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const preview = fs.readFileSync(
  'apps/mobile/src/features/create-trip/commitment-recurring-preview.ts',
  'utf8',
);

const modal = fs.readFileSync(
  'apps/mobile/src/features/create-trip/commitment-recurring-modal.tsx',
  'utf8',
);

const screen = fs.readFileSync(
  'apps/mobile/src/features/create-trip/commitments-screen.tsx',
  'utf8',
);

const card = fs.readFileSync(
  'apps/mobile/src/features/create-trip/commitment-recurring-plan-card.tsx',
  'utf8',
);

test(
  'monthly preview reuses canonical recurrence expansion',
  () => {
    assert.match(
      preview,
      /expandMonthlyDates\(/,
    );

    assert.match(
      preview,
      /paidAmountReflectedInMoney/,
    );
  },
);

test(
  'monthly editor represents an open monthly recurrence rather than fake installments',
  () => {
    assert.match(
      modal,
      /monthlyCommitmentEveryMonth/,
    );

    assert.match(
      modal,
      /monthlyCommitmentNextDueDate/,
    );

    assert.doesNotMatch(
      modal,
      /installmentCount/,
    );

    assert.doesNotMatch(
      modal,
      /createCommitmentInstallmentSchedule/,
    );
  },
);

test(
  'monthly editor locks cadence anchor after payment history exists',
  () => {
    assert.match(
      modal,
      /item\.paidOccurrences/,
    );

    assert.match(
      modal,
      /monthlyCommitmentDateLocked/,
    );
  },
);

test(
  'monthly card shows monthly amount next due and bounded trip impact',
  () => {
    assert.match(
      card,
      /monthlyCommitmentPerMonth/,
    );

    assert.match(
      card,
      /monthlyCommitmentNextDue/,
    );

    assert.match(
      card,
      /monthlyCommitmentWindowImpact/,
    );

    assert.match(
      card,
      /nextUnpaidDate/,
    );
  },
);

test(
  'monthly plan card does not directly delete financial history',
  () => {
    assert.doesNotMatch(
      card,
      /removeRecurringCommitment/,
    );

    assert.doesNotMatch(
      card,
      /onDelete/,
    );
  },
);


test(
  'monthly card exposes exact occurrence lifecycle states without inventing installment order',
  () => {
    assert.match(
      card,
      /buildRecurringCommitmentOccurrencePreview/,
    );

    assert.match(
      card,
      /commitmentPaidStillDeductedShort/,
    );

    assert.match(
      card,
      /commitmentPaidMoneyUpdatedShort/,
    );

    assert.match(
      card,
      /markCommitmentPaid/,
    );

    assert.match(
      card,
      /commitmentPaidImpactAction/,
    );

    assert.doesNotMatch(
      card,
      /isCommitmentInstallmentStatusTransitionAllowed/,
    );
  },
);

test(
  'monthly occurrence actions stay callback-driven after screen wiring',
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


test(
  'D1C1 editor: end mode and actual end date are separate draft truth',
  () => {
    assert.match(
      modal,
      /endMode: RecurringEndMode/,
    );

    assert.match(
      modal,
      /endDate: string \| null/,
    );

    assert.match(
      modal,
      /monthlyCommitmentOnDate/,
    );

    assert.match(
      modal,
      /monthlyCommitmentOngoing/,
    );
  },
);

test(
  'D1C1 editor: validation guards Save and live preview',
  () => {
    assert.match(
      modal,
      /getRecurringCommitmentEndDateError/,
    );

    assert.match(
      modal,
      /endDateError === null/,
    );

    assert.match(
      modal,
      /endDate:\s*effectiveEndDate/,
    );

    assert.match(
      modal,
      /monthlyCommitmentEndBeforePaid/,
    );
  },
);

test(
  'D1C1 editor: screen forwards the end date to the existing store actions',
  () => {
    assert.match(
      screen,
      /function saveRecurringCommitment\([\s\S]*?endDate: string \| null/,
    );

    assert.match(
      screen,
      /updateRecurringCommitment\(/,
    );

    assert.match(
      screen,
      /addRecurringCommitment\(/,
    );
  },
);


test(
  'D1C2 card: both previews use saved recurrence end date',
  () => {
    for (
      const name of [
        'buildRecurringCommitmentWindowPreview',
        'buildRecurringCommitmentOccurrencePreview',
      ]
    ) {
      const start =
        card.indexOf(name + '({');

      assert.ok(
        start >= 0,
        name + ' call missing',
      );

      const end =
        card.indexOf('});', start);

      const call =
        card.slice(start, end + 3);

      assert.match(
        call,
        /endDate:\s*item\.recurrence\.endDate/,
      );
    }
  },
);

test(
  'D1C2 card: saved monthly termination is visible',
  () => {
    assert.match(
      card,
      /monthlyCommitmentOngoing/,
    );

    assert.match(
      card,
      /monthlyCommitmentEndsOn/,
    );

    assert.match(
      card,
      /item\.recurrence\.endDate ===\s*null/,
    );
  },
);
