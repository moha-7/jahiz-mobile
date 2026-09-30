import assert from 'node:assert/strict';
import test from 'node:test';

import {
  tripRecurringCommitmentSchema,
} from '../packages/api-contracts/src/index.ts';

import {
  markRecurringOccurrencePaid,
  markRecurringOccurrenceUnpaid,
  setRecurringOccurrenceMoneyReflected,
  updateRecurringCommitmentPlan,
} from '../apps/mobile/src/features/trip-workspace/recurring-commitment-lifecycle.ts';

const createdAt =
  '2026-09-15T08:00:00.000Z';

const later =
  '2026-09-15T09:00:00.000Z';

function makeRent() {
  return tripRecurringCommitmentSchema.parse({
    id: 'rent',
    title: 'Rent',
    categoryId: 'commitment-rent',
    amount: 2500,
    currency: 'AED',
    recurrence: {
      cadence: 'monthly',
      firstDueDate: '2026-09-25',
    },
    paidOccurrences: [],
    notes: null,
    createdAt,
    updatedAt: createdAt,
  });
}

test(
  'marking a recurring occurrence paid snapshots the exact amount conservatively',
  () => {
    const rent = makeRent();

    const updated =
      markRecurringOccurrencePaid(
        rent,
        '2026-09-25',
        later,
      );

    assert.ok(updated);

    assert.deepEqual(
      updated.paidOccurrences,
      [
        {
          dueDate: '2026-09-25',
          amount: 2500,
          paidAmountReflectedInMoney:
            false,
        },
      ],
    );
  },
);

test(
  'mark paid is idempotent and never duplicates one monthly occurrence',
  () => {
    const first =
      markRecurringOccurrencePaid(
        makeRent(),
        '2026-09-25',
        later,
      );

    assert.ok(first);

    const second =
      markRecurringOccurrencePaid(
        first,
        '2026-09-25',
        later,
      );

    assert.strictEqual(
      second,
      first,
    );

    assert.equal(
      first.paidOccurrences.length,
      1,
    );
  },
);

test(
  'off-cadence recurring occurrence fails closed',
  () => {
    const result =
      markRecurringOccurrencePaid(
        makeRent(),
        '2026-10-24',
        later,
      );

    assert.equal(
      result,
      null,
    );
  },
);

test(
  'Money reflection is explicit and reversible without changing the paid amount snapshot',
  () => {
    const paid =
      markRecurringOccurrencePaid(
        makeRent(),
        '2026-09-25',
        later,
      );

    assert.ok(paid);

    const reflected =
      setRecurringOccurrenceMoneyReflected(
        paid,
        '2026-09-25',
        true,
        later,
      );

    assert.ok(reflected);

    assert.equal(
      reflected.paidOccurrences[0]
        ?.paidAmountReflectedInMoney,
      true,
    );

    assert.equal(
      reflected.paidOccurrences[0]
        ?.amount,
      2500,
    );

    const reversed =
      setRecurringOccurrenceMoneyReflected(
        reflected,
        '2026-09-25',
        false,
        later,
      );

    assert.ok(reversed);

    assert.equal(
      reversed.paidOccurrences[0]
        ?.paidAmountReflectedInMoney,
      false,
    );

    assert.equal(
      reversed.paidOccurrences[0]
        ?.amount,
      2500,
    );
  },
);

test(
  'Money reflection cannot be invented for an unpaid occurrence',
  () => {
    const result =
      setRecurringOccurrenceMoneyReflected(
        makeRent(),
        '2026-09-25',
        true,
        later,
      );

    assert.equal(
      result,
      null,
    );
  },
);

test(
  'undo affects only the exact recurring occurrence',
  () => {
    const september =
      markRecurringOccurrencePaid(
        makeRent(),
        '2026-09-25',
        later,
      );

    assert.ok(september);

    const october =
      markRecurringOccurrencePaid(
        september,
        '2026-10-25',
        later,
      );

    assert.ok(october);

    const undone =
      markRecurringOccurrenceUnpaid(
        october,
        '2026-09-25',
        later,
      );

    assert.deepEqual(
      undone.paidOccurrences.map(
        (item) => item.dueDate,
      ),
      ['2026-10-25'],
    );
  },
);

test(
  'recurring occurrences are independent rather than installment paid-prefix state',
  () => {
    const octoberOnly =
      markRecurringOccurrencePaid(
        makeRent(),
        '2026-10-25',
        later,
      );

    assert.ok(octoberOnly);

    assert.deepEqual(
      octoberOnly.paidOccurrences.map(
        (item) => item.dueDate,
      ),
      ['2026-10-25'],
    );
  },
);

test(
  'editing plan amount preserves historical paid amount snapshots',
  () => {
    const paid =
      markRecurringOccurrencePaid(
        makeRent(),
        '2026-09-25',
        later,
      );

    assert.ok(paid);

    const edited =
      updateRecurringCommitmentPlan(
        paid,
        {
          amount: 2800,
        },
        'AED',
        later,
      );

    assert.ok(edited);

    assert.equal(
      edited.amount,
      2800,
    );

    assert.equal(
      edited.paidOccurrences[0]?.amount,
      2500,
    );
  },
);

test(
  'editing first due date fails closed when it would invalidate paid history',
  () => {
    const paid =
      markRecurringOccurrencePaid(
        makeRent(),
        '2026-10-25',
        later,
      );

    assert.ok(paid);

    const invalid =
      updateRecurringCommitmentPlan(
        paid,
        {
          firstDueDate:
            '2026-09-26',
        },
        'AED',
        later,
      );

    assert.equal(
      invalid,
      null,
    );
  },
);


test(
  'D1A end date: editing an end date preserves historical paid snapshots',
  () => {
    const paid =
      markRecurringOccurrencePaid(
        makeRent(),
        '2026-09-25',
        later,
      );

    assert.ok(paid);

    const edited =
      updateRecurringCommitmentPlan(
        paid,
        {
          endDate:
            '2026-11-30',
        },
        'AED',
        later,
      );

    assert.ok(edited);

    assert.equal(
      edited.recurrence.endDate,
      '2026-11-30',
    );

    assert.deepEqual(
      edited.paidOccurrences,
      paid.paidOccurrences,
    );
  },
);

test(
  'D1A end date: ending before paid history fails closed',
  () => {
    const paid =
      markRecurringOccurrencePaid(
        makeRent(),
        '2026-11-25',
        later,
      );

    assert.ok(paid);

    const invalid =
      updateRecurringCommitmentPlan(
        paid,
        {
          endDate:
            '2026-10-31',
        },
        'AED',
        later,
      );

    assert.equal(
      invalid,
      null,
    );
  },
);

test(
  'D1A end date: marking payment after series end fails closed',
  () => {
    const base =
      makeRent();

    const ended =
      tripRecurringCommitmentSchema.parse({
        ...base,
        recurrence: {
          ...base.recurrence,
          endDate:
            '2026-10-31',
        },
      });

    const invalid =
      markRecurringOccurrencePaid(
        ended,
        '2026-11-25',
        later,
      );

    assert.equal(
      invalid,
      null,
    );
  },
);

test(
  'D1A end date: ended series can resume to ongoing',
  () => {
    const ended =
      updateRecurringCommitmentPlan(
        makeRent(),
        {
          endDate:
            '2026-10-31',
        },
        'AED',
        later,
      );

    assert.ok(ended);

    const resumed =
      updateRecurringCommitmentPlan(
        ended,
        {
          endDate: null,
        },
        'AED',
        later,
      );

    assert.ok(resumed);

    assert.equal(
      resumed.recurrence.endDate,
      null,
    );
  },
);
