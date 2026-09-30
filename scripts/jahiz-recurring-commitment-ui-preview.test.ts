import {
  getRecurringCommitmentEndDateError,
} from '../apps/mobile/src/features/create-trip/commitment-recurring-end-date.ts';
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildRecurringCommitmentOccurrencePreview,
  buildRecurringCommitmentWindowPreview,
} from '../apps/mobile/src/features/create-trip/commitment-recurring-preview.ts';

test(
  'monthly preview includes only occurrences through return',
  () => {
    const preview =
      buildRecurringCommitmentWindowPreview({
        firstDueDate:
          '2026-09-25',
        amount: 2500,
        returnDate:
          '2026-12-26',
      });

    assert.ok(preview);

    assert.deepEqual(
      preview.occurrenceDates,
      [
        '2026-09-25',
        '2026-10-25',
        '2026-11-25',
        '2026-12-25',
      ],
    );

    assert.equal(
      preview.count,
      4,
    );

    assert.equal(
      preview.total,
      10000,
    );

    assert.equal(
      preview.countedTotal,
      10000,
    );

    assert.equal(
      preview.nextUnpaidDate,
      '2026-09-25',
    );
  },
);

test(
  'historical paid amount snapshot is preserved in the UI preview',
  () => {
    const preview =
      buildRecurringCommitmentWindowPreview({
        firstDueDate:
          '2026-09-25',
        amount: 2800,
        returnDate:
          '2026-10-30',
        paidOccurrences: [
          {
            dueDate:
              '2026-09-25',
            amount: 2500,
            paidAmountReflectedInMoney:
              false,
          },
        ],
      });

    assert.ok(preview);

    assert.equal(
      preview.total,
      5300,
    );

    assert.equal(
      preview.countedTotal,
      5300,
    );

    assert.equal(
      preview.paidCount,
      1,
    );

    assert.equal(
      preview.nextUnpaidDate,
      '2026-10-25',
    );
  },
);

test(
  'paid and reflected occurrence stays visible historically but stops affecting counted total',
  () => {
    const preview =
      buildRecurringCommitmentWindowPreview({
        firstDueDate:
          '2026-09-25',
        amount: 2800,
        returnDate:
          '2026-10-30',
        paidOccurrences: [
          {
            dueDate:
              '2026-09-25',
            amount: 2500,
            paidAmountReflectedInMoney:
              true,
          },
        ],
      });

    assert.ok(preview);

    assert.equal(
      preview.total,
      5300,
    );

    assert.equal(
      preview.countedTotal,
      2800,
    );

    assert.equal(
      preview.paidCount,
      1,
    );
  },
);

test(
  'preview remains unknown without return date',
  () => {
    assert.equal(
      buildRecurringCommitmentWindowPreview({
        firstDueDate:
          '2026-09-25',
        amount: 2500,
        returnDate:
          null,
      }),
      null,
    );
  },
);

test(
  'first due date after return creates zero trip-window occurrences',
  () => {
    const preview =
      buildRecurringCommitmentWindowPreview({
        firstDueDate:
          '2027-01-25',
        amount: 2500,
        returnDate:
          '2026-12-26',
      });

    assert.ok(preview);

    assert.equal(
      preview.count,
      0,
    );

    assert.equal(
      preview.total,
      0,
    );

    assert.equal(
      preview.countedTotal,
      0,
    );

    assert.equal(
      preview.nextUnpaidDate,
      null,
    );
  },
);


test(
  'occurrence preview keeps exact paid states and historical snapshots',
  () => {
    const occurrences =
      buildRecurringCommitmentOccurrencePreview({
        firstDueDate:
          '2026-09-25',
        amount: 2800,
        returnDate:
          '2026-11-30',
        paidOccurrences: [
          {
            dueDate:
              '2026-09-25',
            amount: 2500,
            paidAmountReflectedInMoney:
              false,
          },
          {
            dueDate:
              '2026-10-25',
            amount: 2600,
            paidAmountReflectedInMoney:
              true,
          },
        ],
      });

    assert.ok(occurrences);

    assert.deepEqual(
      occurrences,
      [
        {
          dueDate:
            '2026-09-25',
          amount: 2500,
          status:
            'paid-counted',
        },
        {
          dueDate:
            '2026-10-25',
          amount: 2600,
          status:
            'paid-reflected',
        },
        {
          dueDate:
            '2026-11-25',
          amount: 2800,
          status:
            'unpaid',
        },
      ],
    );
  },
);

test(
  'occurrence preview stays unknown when the trip window is unknown',
  () => {
    assert.equal(
      buildRecurringCommitmentOccurrencePreview({
        firstDueDate:
          '2026-09-25',
        amount: 2500,
        returnDate: null,
      }),
      null,
    );
  },
);


test(
  'D1A end date: ongoing preview stays bounded by trip return',
  () => {
    const result =
      buildRecurringCommitmentWindowPreview({
        firstDueDate:
          '2026-09-25',
        amount: 2500,
        returnDate:
          '2026-12-28',
        endDate: null,
      });

    assert.ok(result);

    assert.deepEqual(
      result.occurrenceDates,
      [
        '2026-09-25',
        '2026-10-25',
        '2026-11-25',
        '2026-12-25',
      ],
    );

    assert.equal(
      result.total,
      10000,
    );
  },
);

test(
  'D1A end date: known end caps preview before return',
  () => {
    const result =
      buildRecurringCommitmentWindowPreview({
        firstDueDate:
          '2026-09-25',
        amount: 2500,
        returnDate:
          '2026-12-28',
        endDate:
          '2026-11-30',
      });

    assert.ok(result);

    assert.deepEqual(
      result.occurrenceDates,
      [
        '2026-09-25',
        '2026-10-25',
        '2026-11-25',
      ],
    );

    assert.equal(
      result.total,
      7500,
    );
  },
);

test(
  'D1A end date: arbitrary end includes only due dates on or before it',
  () => {
    const result =
      buildRecurringCommitmentWindowPreview({
        firstDueDate:
          '2026-09-25',
        amount: 2500,
        returnDate:
          '2026-12-28',
        endDate:
          '2026-10-10',
      });

    assert.ok(result);

    assert.deepEqual(
      result.occurrenceDates,
      [
        '2026-09-25',
      ],
    );
  },
);

test(
  'D1A end date: month-end clamping remains deterministic',
  () => {
    const result =
      buildRecurringCommitmentWindowPreview({
        firstDueDate:
          '2026-01-31',
        amount: 1000,
        returnDate:
          '2026-04-30',
        endDate:
          '2026-03-15',
      });

    assert.ok(result);

    assert.deepEqual(
      result.occurrenceDates,
      [
        '2026-01-31',
        '2026-02-28',
      ],
    );
  },
);


test(
  'D1C1 end date: ongoing does not demand an end date',
  () => {
    assert.equal(
      getRecurringCommitmentEndDateError({
        endMode: 'ongoing',
        endDate: null,
        firstDueDate: '2026-09-25',
        paidDates: [],
      }),
      null,
    );
  },
);

test(
  'D1C1 end date: selected On a date requires a real date',
  () => {
    for (
      const endDate of [
        null,
        '2026-02-30',
        'not-a-date',
      ]
    ) {
      assert.equal(
        getRecurringCommitmentEndDateError({
          endMode: 'date',
          endDate,
          firstDueDate: '2026-09-25',
          paidDates: [],
        }),
        'required',
      );
    }
  },
);

test(
  'D1C1 end date: cannot end before first due',
  () => {
    assert.equal(
      getRecurringCommitmentEndDateError({
        endMode: 'date',
        endDate: '2026-09-24',
        firstDueDate: '2026-09-25',
        paidDates: [],
      }),
      'beforeFirstDue',
    );
  },
);

test(
  'D1C1 end date: cannot exclude a historical paid occurrence',
  () => {
    assert.equal(
      getRecurringCommitmentEndDateError({
        endMode: 'date',
        endDate: '2026-10-31',
        firstDueDate: '2026-09-25',
        paidDates: [
          '2026-09-25',
          '2026-11-25',
        ],
      }),
      'beforePaid',
    );
  },
);

test(
  'D1C1 end date: inclusive first due and paid dates are allowed',
  () => {
    assert.equal(
      getRecurringCommitmentEndDateError({
        endMode: 'date',
        endDate: '2026-11-25',
        firstDueDate: '2026-09-25',
        paidDates: [
          '2026-09-25',
          '2026-11-25',
        ],
      }),
      null,
    );
  },
);
