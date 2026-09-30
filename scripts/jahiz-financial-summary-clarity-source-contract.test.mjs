import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const commitments =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/create-trip/commitments-screen.tsx',
      import.meta.url,
    ),
    'utf8',
  );

const plan =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/plan/plan-screen.tsx',
      import.meta.url,
    ),
    'utf8',
  );

const payments =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/payments/payments-screen.tsx',
      import.meta.url,
    ),
    'utf8',
  );

const selectors =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/trip-workspace/trip-workspace-selectors.ts',
      import.meta.url,
    ),
    'utf8',
  );

const i18n =
  fs.readFileSync(
    new URL(
      '../packages/i18n/src/index.ts',
      import.meta.url,
    ),
    'utf8',
  );

test(
  'commitment summary labels counted Ready Money impact separately from unpaid obligations',
  () => {
    assert.match(
      commitments,
      /t\('commitmentsReadyMoneyDeduction'\)/,
    );

    assert.match(
      commitments,
      /t\('commitmentsAllUnpaid'\)/,
    );

    assert.match(
      commitments,
      /t\('commitmentsItemsMetric'\)/,
    );

    assert.match(
      i18n,
      /commitmentsReadyMoneyDeduction: 'Counted against Ready Money'/,
    );

    assert.match(
      i18n,
      /commitmentsAllUnpaid: 'All unpaid'/,
    );
  },
);

test(
  'trip spending copy explicitly excludes spending budget from booking balance',
  () => {
    assert.match(
      i18n,
      /tripSpendingBudgetHelper: 'Not a booking\.[^']*excluded from Bookings left\.'/,
    );

    assert.match(
      i18n,
      /tripSpendingBudgetHelper: 'دي مش حجوزات\.[^']*مش يدخلوا في المتبقي للحجوزات\.'/,
    );
  },
);

test(
  'Ready Money breakdown is rendered from the same formula inputs as the selector',
  () => {
    assert.match(
      selectors,
      /selectReadyMoneyBreakdown[\s\S]*?selectUsableTripMoneyTotal[\s\S]*?safetyReserve[\s\S]*?selectTripWindowCommitmentsTotal/,
    );

    assert.match(
      plan,
      /selectReadyMoneyBreakdown/,
    );

    assert.match(
      plan,
      /readyMoneyUsableThroughReturn/,
    );
    assert.match(
      plan,
      /readyMoneySafetyReserve/,
    );
    assert.match(
      plan,
      /readyMoneyCommitmentsDeduction/,
    );
    assert.match(
      plan,
      /readyMoneyBreakdown[\s\S]*?\.readyMoney/,
    );

    assert.doesNotMatch(
      plan,
      /selectExpectedByReturnMoneyInTotal/,
    );
  },
);

test(
  'Bookings left shows booking total minus paid while scheduled remains informational',
  () => {
    assert.match(
      payments,
      /bookingBalanceCalculation/,
    );

    assert.match(
      payments,
      /paymentBookingTotal[\s\S]*?bookingTotal[\s\S]*?t\('paid'\)[\s\S]*?paidTotal[\s\S]*?todayBookingsLeftLabel[\s\S]*?remainingTotal/,
    );

    assert.match(
      payments,
      /bookingScheduledStillOutstanding[\s\S]*?scheduledTotal/,
    );

    assert.match(
      i18n,
      /bookingScheduledStillOutstanding: '\{amount\} scheduled is still unpaid and stays inside Bookings left until it is marked paid\.'/,
    );
  },
);
