import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  buildJahizDecisionState,
  type JahizDecisionStateInput,
} from '../apps/mobile/src/features/moves/jahiz-decision-state.ts';

const decisionContextSource =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/moves/jahiz-decision-context.ts',
      import.meta.url,
    ),
    'utf8',
  );

function base(
  overrides: Partial<JahizDecisionStateInput> = {},
): JahizDecisionStateInput {
  return {
    todayIso: '2026-08-10',
    departureDate: '2026-08-20',
    returnDate: '2026-08-25',
    planProgress: 100,
    nextIncompleteRoute: null,
    needToSave: 0,
    bookingRemainingTotal: 0,
    paymentPlanCoverage: 100,
    onTripBudget: 700,
    overdueCommitment: null,
    overduePayment: null,
    ...overrides,
  };
}

test('decision context derives the first unresolved required setup route from existing step truth', () => {
  assert.match(
    decisionContextSource,
    /for \(const step of steps\)[\s\S]*?!step\.required[\s\S]*?step\.status === 'complete'[\s\S]*?setupRouteForStep\([\s\S]*?step\.key/,
  );

  assert.match(
    decisionContextSource,
    /case 'route':[\s\S]*?'\/trip\/create\/route'[\s\S]*?case 'dates':[\s\S]*?'\/trip\/create\/dates'[\s\S]*?case 'funds':[\s\S]*?'\/trip\/create\/funds'[\s\S]*?case 'commitments':[\s\S]*?'\/trip\/create\/commitments'[\s\S]*?case 'costs':[\s\S]*?'\/trip\/create\/costs'/,
  );

  assert.match(
    decisionContextSource,
    /const nextIncompleteRoute =[\s\S]*?selectNextIncompleteSetupRoute\([\s\S]*?summary\.steps/,
  );
});

test('an incomplete Route stays ahead of Dates in an unscheduled plan', () => {
  const state = buildJahizDecisionState(
    base({
      departureDate: null,
      returnDate: null,
      planProgress: 0,
      nextIncompleteRoute:
        '/trip/create/route',
    }),
  );

  assert.equal(state.lifecycle, 'unscheduled');
  assert.equal(state.reason, 'plan-incomplete');
  assert.equal(
    state.route,
    '/trip/create/route',
  );
  assert.equal(state.showReadinessScore, false);
});

test('unscheduled trips ask for dates after Route is complete', () => {
  const state = buildJahizDecisionState(
    base({
      departureDate: null,
      returnDate: null,
      nextIncompleteRoute:
        '/trip/create/dates',
    }),
  );

  assert.equal(state.lifecycle, 'unscheduled');
  assert.equal(state.reason, 'set-dates');
  assert.equal(state.route, '/trip/create/dates');
  assert.equal(state.showReadinessScore, false);
});

test('an overdue commitment outranks a funding gap', () => {
  const state = buildJahizDecisionState(
    base({
      needToSave: 900,
      overdueCommitment: {
        title: 'Rent',
        amount: 1700,
        dueDate: '2026-08-09',
      },
    }),
  );

  assert.equal(
    state.reason,
    'overdue-commitment',
  );
  assert.equal(
    state.route,
    '/trip/create/commitments',
  );
  assert.equal(state.severity, 'attention');
});

test('known overdue truth still outranks incomplete setup', () => {
  const state = buildJahizDecisionState(
    base({
      planProgress: 80,
      nextIncompleteRoute:
        '/trip/create/funds',
      needToSave: 3000,
      overduePayment: {
        title: 'Flight',
        amount: 500,
        dueDate: '2026-08-09',
      },
    }),
  );

  assert.equal(state.reason, 'overdue-payment');
  assert.equal(state.route, '/payments');
});

test('the oldest overdue item wins across payments and commitments', () => {
  const state = buildJahizDecisionState(
    base({
      overdueCommitment: {
        title: 'Rent',
        amount: 1700,
        dueDate: '2026-08-09',
      },
      overduePayment: {
        title: 'Flight',
        amount: 300,
        dueDate: '2026-08-08',
      },
    }),
  );

  assert.equal(state.reason, 'overdue-payment');
  assert.equal(state.attention?.title, 'Flight');
});

test('unreviewed Money stays plan-incomplete instead of becoming a numeric funding gap', () => {
  const state = buildJahizDecisionState(
    base({
      planProgress: 80,
      nextIncompleteRoute:
        '/trip/create/funds',
      needToSave: 3000,
    }),
  );

  assert.equal(state.lifecycle, 'pre-trip');
  assert.equal(state.reason, 'plan-incomplete');
  assert.equal(
    state.route,
    '/trip/create/funds',
  );
  assert.equal(state.showReadinessScore, false);
});

test('pre-trip funding gap opens the Money action after required setup is complete', () => {
  const state = buildJahizDecisionState(
    base({
      needToSave: 900,
    }),
  );

  assert.equal(state.lifecycle, 'pre-trip');
  assert.equal(state.reason, 'funding-gap');
  assert.equal(
    state.route,
    '/trip/create/funds',
  );
  assert.equal(state.showReadinessScore, true);
});

test('incomplete required setup stays ahead of booking-payment advice', () => {
  const state = buildJahizDecisionState(
    base({
      planProgress: 80,
      nextIncompleteRoute:
        '/trip/create/costs',
      bookingRemainingTotal: 1200,
      paymentPlanCoverage: 45,
    }),
  );

  assert.equal(state.reason, 'plan-incomplete');
  assert.equal(
    state.route,
    '/trip/create/costs',
  );
  assert.equal(state.showReadinessScore, false);
});

test('uncovered booking payments become actionable after required setup is complete', () => {
  const state = buildJahizDecisionState(
    base({
      bookingRemainingTotal: 1200,
      paymentPlanCoverage: 45,
    }),
  );

  assert.equal(state.reason, 'bookings-left');
  assert.equal(state.route, '/payments');
  assert.equal(state.showReadinessScore, true);
});

test('an incomplete pre-trip plan opens its unresolved setup action', () => {
  const state = buildJahizDecisionState(
    base({
      planProgress: 80,
      nextIncompleteRoute:
        '/trip/create/costs',
    }),
  );

  assert.equal(state.reason, 'plan-incomplete');
  assert.equal(
    state.route,
    '/trip/create/costs',
  );
  assert.equal(state.showReadinessScore, false);
});

test('a complete covered pre-trip plan points to Moves', () => {
  const state = buildJahizDecisionState(base());

  assert.equal(state.reason, 'review-moves');
  assert.equal(state.route, '/moves');
  assert.equal(state.severity, 'positive');
  assert.equal(state.showReadinessScore, true);
});

test('an in-progress trip stops using readiness and focuses on spending', () => {
  const state = buildJahizDecisionState(
    base({
      todayIso: '2026-08-22',
    }),
  );

  assert.equal(state.lifecycle, 'in-progress');
  assert.equal(state.dayNumber, 3);
  assert.equal(state.totalDays, 6);
  assert.equal(state.reason, 'review-spending');
  assert.equal(state.showReadinessScore, false);
});

test('the return date is a distinct last-day lifecycle', () => {
  const state = buildJahizDecisionState(
    base({
      todayIso: '2026-08-25',
    }),
  );

  assert.equal(state.lifecycle, 'last-day');
  assert.equal(state.dayNumber, 6);
  assert.equal(state.totalDays, 6);
  assert.equal(state.reason, 'review-spending');
});

test('completed trips stop offering pre-trip decisions', () => {
  const state = buildJahizDecisionState(
    base({
      todayIso: '2026-08-26',
    }),
  );

  assert.equal(state.lifecycle, 'completed');
  assert.equal(state.reason, 'trip-complete');
  assert.equal(state.route, '/plan');
  assert.equal(state.showReadinessScore, false);
});
