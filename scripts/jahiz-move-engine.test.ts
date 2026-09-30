import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildJahizMoveCandidates,
  rankJahizMoves,
  type JahizMoveEngineInput,
} from '../apps/mobile/src/features/moves/jahiz-move-engine.ts';
import type {
  JahizDecisionState,
} from '../apps/mobile/src/features/moves/jahiz-decision-state.ts';
import {
  resolveJahizMoveTimingGuidance,
} from '../apps/mobile/src/features/moves/jahiz-move-timing-guidance.ts';

function decision(
  overrides: Partial<JahizDecisionState> = {},
): JahizDecisionState {
  return {
    lifecycle: 'pre-trip',
    reason: 'review-moves',
    severity: 'positive',
    route: '/moves',
    attention: null,
    dayNumber: null,
    totalDays: 6,
    showReadinessScore: true,
    ...overrides,
  };
}

function input(
  overrides: Partial<JahizMoveEngineInput> = {},
): JahizMoveEngineInput {
  return {
    decision: decision(),
    planProgress: 100,
    needToSave: 0,
    bookingRemainingTotal: 0,
    paymentPlanCoverage: 100,
    onTripBudget: 700,
    ...overrides,
  };
}

test('the current Decision State always becomes a primary candidate', () => {
  const candidates =
    buildJahizMoveCandidates(
      input({
        decision: decision({
          reason: 'funding-gap',
          route: '/trip/create/funds',
          severity: 'attention',
        }),
        needToSave: 900,
      }),
    );

  assert.equal(
    candidates[0]?.kind,
    'funding-gap',
  );
  assert.equal(
    candidates[0]?.primary,
    true,
  );
  assert.equal(
    candidates[0]?.impactAmount,
    900,
  );
  assert.equal(
    candidates[0]?.route,
    '/trip/create/funds',
  );
});

test('an incomplete-plan Move keeps the direct unresolved setup route', () => {
  const candidates =
    buildJahizMoveCandidates(
      input({
        decision: decision({
          reason: 'plan-incomplete',
          route: '/trip/create/costs',
          severity: 'action',
        }),
        planProgress: 80,
      }),
    );

  assert.equal(
    candidates[0]?.kind,
    'plan-incomplete',
  );
  assert.equal(
    candidates[0]?.route,
    '/trip/create/costs',
  );
});

test('an incomplete plan is not added as a generic secondary hub Move', () => {
  const candidates =
    buildJahizMoveCandidates(
      input({
        decision: decision({
          reason: 'funding-gap',
          route: '/trip/create/funds',
          severity: 'attention',
        }),
        planProgress: 75,
        needToSave: 900,
      }),
    );

  assert.deepEqual(
    candidates.map((item) => item.kind),
    ['funding-gap'],
  );
});

test('overdue commitment remains the strongest move', () => {
  const candidates =
    buildJahizMoveCandidates(
      input({
        decision: decision({
          reason:
            'overdue-commitment',
          route:
            '/trip/create/commitments',
          severity: 'attention',
          attention: {
            kind: 'commitment',
            title: 'Rent',
            amount: 1700,
            dueDate: '2026-08-09',
          },
        }),
        bookingRemainingTotal: 1200,
      }),
    );

  const ranked =
    rankJahizMoves(candidates);

  assert.equal(
    ranked[0]?.kind,
    'overdue-commitment',
  );
  assert.equal(
    ranked[0]?.role,
    'best-move',
  );
});

test('ranking never exposes more than three moves by default', () => {
  const ranked = rankJahizMoves(
    buildJahizMoveCandidates(
      input({
        decision: decision({
          reason: 'funding-gap',
          route: '/trip/create/funds',
          severity: 'attention',
        }),
        needToSave: 900,
        bookingRemainingTotal: 1200,
        paymentPlanCoverage: 40,
        planProgress: 75,
        onTripBudget: 800,
      }),
    ),
  );

  assert.ok(ranked.length <= 3);
  assert.equal(
    ranked[0]?.role,
    'best-move',
  );
});

test('quick win prefers lower-friction remaining action', () => {
  const ranked = rankJahizMoves(
    buildJahizMoveCandidates(
      input({
        decision: decision({
          reason: 'funding-gap',
          route: '/trip/create/funds',
          severity: 'attention',
        }),
        needToSave: 900,
        bookingRemainingTotal: 1200,
        planProgress: 75,
        onTripBudget: 800,
      }),
    ),
  );

  assert.equal(
    ranked[1]?.role,
    'quick-win',
  );

  assert.notEqual(
    ranked[1]?.kind,
    'funding-gap',
  );
});

test('completed trips do not receive pre-trip optimization candidates', () => {
  const candidates =
    buildJahizMoveCandidates(
      input({
        decision: decision({
          lifecycle: 'completed',
          reason: 'trip-complete',
          route: '/plan',
          showReadinessScore: false,
        }),
        bookingRemainingTotal: 1200,
        planProgress: 60,
        onTripBudget: 800,
      }),
    );

  assert.deepEqual(
    candidates.map((item) => item.kind),
    ['trip-complete'],
  );
});

test('in-progress trips can surface spending without readiness logic', () => {
  const ranked = rankJahizMoves(
    buildJahizMoveCandidates(
      input({
        decision: decision({
          lifecycle: 'in-progress',
          reason: 'review-spending',
          route: '/trip/create/costs',
          showReadinessScore: false,
          dayNumber: 3,
        }),
        onTripBudget: 700,
      }),
    ),
  );

  assert.equal(
    ranked[0]?.kind,
    'review-spending',
  );
});

test('complete pre-trip planning does not create a review-spending filler move', () => {
  const candidates =
    buildJahizMoveCandidates(
      input({
        decision: decision({
          reason: 'funding-gap',
          route: '/trip/create/funds',
          severity: 'attention',
        }),
        planProgress: 100,
        needToSave: 3253.19,
        bookingRemainingTotal: 3000,
        paymentPlanCoverage: 0,
        onTripBudget: 1800,
      }),
    );

  assert.deepEqual(
    candidates.map((item) => item.kind),
    [
      'funding-gap',
      'bookings-left',
    ],
  );
  assert.equal(
    candidates[0]?.route,
    '/trip/create/funds',
  );
  assert.equal(
    candidates[1]?.route,
    '/payments',
  );
});

test('move ranking is deterministic for identical inputs', () => {
  const one = rankJahizMoves(
    buildJahizMoveCandidates(
      input({
        bookingRemainingTotal: 1200,
        planProgress: 80,
        onTripBudget: 700,
      }),
    ),
  );

  const two = rankJahizMoves(
    buildJahizMoveCandidates(
      input({
        bookingRemainingTotal: 1200,
        planProgress: 80,
        onTripBudget: 700,
      }),
    ),
  );

  assert.deepEqual(one, two);
});

test('the engine never mutates its input decision', () => {
  const source = input({
    decision: decision({
      reason: 'funding-gap',
      route: '/trip/create/funds',
      severity: 'attention',
    }),
    needToSave: 900,
  });

  const before = JSON.stringify(source);

  buildJahizMoveCandidates(source);

  assert.equal(
    JSON.stringify(source),
    before,
  );
});


test('ranking does not invent filler moves just to reach three', () => {
  const source = input({
    decision: decision({
      reason: 'overdue-commitment',
      route: '/trip/create/commitments',
      severity: 'attention',
      attention: {
        kind: 'commitment',
        title: 'Rent',
        amount: 1700,
        dueDate: '2026-08-09',
      },
    }),
    planProgress: 100,
    needToSave: 0,
    bookingRemainingTotal: 0,
    paymentPlanCoverage: 100,
    onTripBudget: 0,
  });

  const ranked = rankJahizMoves(
    buildJahizMoveCandidates(source),
  );

  assert.equal(ranked.length, 1);
  assert.equal(
    ranked[0]?.kind,
    'overdue-commitment',
  );
});


test('timing guidance stays hidden until required pre-trip setup is complete', () => {
  const result =
    resolveJahizMoveTimingGuidance({
      lifecycle: 'pre-trip',
      planProgress: 80,
      hasDates: true,
      flexibility: 'flexible',
      recommendation: {
        checkedOffsets: [7, 14, 30],
        best: null,
        candidates: [],
      },
    });

  assert.deepEqual(result, {
    kind: 'hidden',
  });
});

test('fixed dates explain suppression instead of pretending timing was compared', () => {
  const result =
    resolveJahizMoveTimingGuidance({
      lifecycle: 'pre-trip',
      planProgress: 100,
      hasDates: true,
      flexibility: 'fixed',
      recommendation: null,
    });

  assert.deepEqual(result, {
    kind: 'fixed',
  });
});

test('flexible dates with no positive known delta surface a neutral result', () => {
  const result =
    resolveJahizMoveTimingGuidance({
      lifecycle: 'pre-trip',
      planProgress: 100,
      hasDates: true,
      flexibility: 'flexible',
      recommendation: {
        checkedOffsets: [7, 14, 30],
        best: null,
        candidates: [],
      },
    });

  assert.deepEqual(result, {
    kind: 'no-known-improvement',
    checkedOffsets: [7, 14, 30],
  });
});

test('positive flexible timing maps only known cash-flow deltas and repricing uncertainty', () => {
  const result =
    resolveJahizMoveTimingGuidance({
      lifecycle: 'pre-trip',
      planProgress: 100,
      hasDates: true,
      flexibility: 'flexible',
      recommendation: {
        checkedOffsets: [7, 14, 30],
        candidates: [],
        best: {
          offsetDays: 14,
          proposedDates: {
            departureDate: '2026-10-20',
            returnDate: '2026-10-26',
          },
          comparison: {
            current: {
              inflowBeforeTrip: 1000,
              outflowBeforeTrip: 500,
              netBeforeTrip: 500,
              inflowDuringTrip: 0,
              outflowDuringTrip: 0,
              netDuringTrip: 0,
              exactEventCount: 2,
              windowOnlyEventCount: 0,
            },
            proposed: {
              inflowBeforeTrip: 1800,
              outflowBeforeTrip: 650,
              netBeforeTrip: 1150,
              inflowDuringTrip: 0,
              outflowDuringTrip: 0,
              netDuringTrip: 0,
              exactEventCount: 3,
              windowOnlyEventCount: 0,
            },
            deltaInflowBeforeTrip: 800,
            deltaOutflowBeforeTrip: 150,
            deltaNetBeforeTrip: 650,
            unknowns: [
              'trip-cost-repricing',
            ],
          },
          addedBeforeTripEvents: [],
          removedBeforeTripEvents: [],
        },
      },
    });

  assert.deepEqual(result, {
    kind: 'better-timing',
    offsetDays: 14,
    proposedDepartureDate:
      '2026-10-20',
    knownImprovement: 650,
    repricingUnknown: true,
  });
});
