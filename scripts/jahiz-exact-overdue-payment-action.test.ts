import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  buildJahizDecisionState,
  type JahizDecisionStateInput,
} from '../apps/mobile/src/features/moves/jahiz-decision-state.ts';
import {
  buildJahizMoveCandidates,
} from '../apps/mobile/src/features/moves/jahiz-move-engine.ts';

function base(
  overrides: Partial<JahizDecisionStateInput> = {},
): JahizDecisionStateInput {
  return {
    todayIso: '2026-09-04',
    departureDate: '2026-09-20',
    returnDate: '2026-09-25',
    planProgress: 100,
    nextIncompleteRoute: null,
    needToSave: 0,
    bookingRemainingTotal: 0,
    paymentPlanCoverage: 100,
    onTripBudget: 0,
    overdueCommitment: null,
    overduePayment: null,
    ...overrides,
  };
}

test('overdue payment decision preserves the exact focused payment action', () => {
  const state = buildJahizDecisionState(
    base({
      overduePayment: {
        id: 'payment/flight 1',
        title: 'Flight',
        amount: 500,
        dueDate: '2026-09-03',
      },
    }),
  );

  assert.equal(state.reason, 'overdue-payment');
  assert.equal(
    state.route,
    '/payments?focus=next-payment&id=payment%2Fflight%201',
  );
  assert.equal(
    state.attention?.id,
    'payment/flight 1',
  );
});

test('overdue payment keeps the generic Payments fallback when an id is unavailable', () => {
  const state = buildJahizDecisionState(
    base({
      overduePayment: {
        title: 'Flight',
        amount: 500,
        dueDate: '2026-09-03',
      },
    }),
  );

  assert.equal(state.reason, 'overdue-payment');
  assert.equal(state.route, '/payments');
});

test('the overdue-payment Move keeps the same exact focused action as Decision State', () => {
  const decision = buildJahizDecisionState(
    base({
      overduePayment: {
        id: 'payment-123',
        title: 'Hotel',
        amount: 800,
        dueDate: '2026-09-02',
      },
    }),
  );

  const moves = buildJahizMoveCandidates({
    decision,
    planProgress: 100,
    needToSave: 0,
    bookingRemainingTotal: 0,
    paymentPlanCoverage: 100,
    onTripBudget: 0,
  });

  assert.equal(moves[0]?.kind, 'overdue-payment');
  assert.equal(moves[0]?.route, decision.route);
  assert.equal(
    moves[0]?.route,
    '/payments?focus=next-payment&id=payment-123',
  );
});

test('the exact payment id is wired from decision context to the existing Payments focus contract', () => {
  const context = fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/moves/jahiz-decision-context.ts',
      import.meta.url,
    ),
    'utf8',
  );
  const today = fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/today/today-screen.tsx',
      import.meta.url,
    ),
    'utf8',
  );
  const moves = fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/moves/moves-screen.tsx',
      import.meta.url,
    ),
    'utf8',
  );
  const payments = fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/payments/payments-screen.tsx',
      import.meta.url,
    ),
    'utf8',
  );

  assert.match(
    context,
    /overduePayment:[\s\S]*?id:[\s\S]*?overdueTrackedPayment\.id/,
  );
  assert.match(
    today,
    /router\.push\([\s\S]*?decision\.route as Href/,
  );
  assert.match(
    moves,
    /router\.push\([\s\S]*?move\.route as Href/,
  );
  assert.match(
    payments,
    /params\.focus ===[\s\S]*?'next-payment'[\s\S]*?params\.id ===[\s\S]*?nextPayment\.id/,
  );
});
