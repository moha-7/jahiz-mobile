import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const focusContract =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/navigation/deep-link-focus.ts',
      import.meta.url,
    ),
    'utf8',
  );

const today =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/today/today-screen.tsx',
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

const commitments =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/create-trip/commitments-screen.tsx',
      import.meta.url,
    ),
    'utf8',
  );

const highlight =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/components/jz-focus-highlight.tsx',
      import.meta.url,
    ),
    'utf8',
  );

test(
  'dashboard focus targets use one route + focus + optional entity id contract',
  () => {
    assert.match(
      focusContract,
      /type JahizFocusTarget = \{[\s\S]*?route: JahizFocusRoute;[\s\S]*?focus: JahizFocusKey;[\s\S]*?entityId\?: string;/,
    );

    assert.match(
      focusContract,
      /readyMoney:[\s\S]*?route: '\/plan',[\s\S]*?focus: 'ready-money'/,
    );

    assert.match(
      focusContract,
      /bookings:[\s\S]*?route: '\/payments',[\s\S]*?focus: 'bookings'/,
    );

    assert.match(
      focusContract,
      /needToSave:[\s\S]*?route: '\/plan',[\s\S]*?focus: 'need-to-save'/,
    );

    assert.match(
      focusContract,
      /entityId[\s\S]*?id=\$\{encodeURIComponent/,
    );
  },
);

test(
  'Today snapshot KPIs navigate through the shared focus contract',
  () => {
    assert.match(
      today,
      /buildJahizFocusHref/,
    );

    assert.match(
      today,
      /jahizFocusTargets\.readyMoney/,
    );

    assert.match(
      today,
      /jahizFocusTargets\.bookings/,
    );

    assert.match(
      today,
      /SnapshotCard[\s\S]*?onPress/,
    );
  },
);

test(
  'Today funding gap action navigates to Need to Save focus target',
  () => {
    assert.match(
      today,
      /function openNextMove\(\)[\s\S]*?case 'funding-gap':[\s\S]*?openFocusTarget\([\s\S]*?jahizFocusTargets\.needToSave/,
    );

    assert.match(
      today,
      /onPress=\{openNextMove\}/,
    );
  },
);

test(
  'Ready Money deep link expands and highlights the Plan money target',
  () => {
    assert.match(
      plan,
      /case 'ready-money':[\s\S]*?setExpandedKey\('money'\)/,
    );

    assert.match(
      plan,
      /JzFocusHighlight[\s\S]*?params\.focus === 'ready-money'[\s\S]*?PlanStepCard[\s\S]*?stepKey="money"/,
    );

    assert.doesNotMatch(
      plan,
      /\?focus=\$\{encodeURIComponent/,
    );
  },
);

test(
  'Need to Save deep link expands the Plan money target',
  () => {
    assert.match(
      focusContract,
      /needToSave:[\s\S]*?route: '\/plan',[\s\S]*?focus: 'need-to-save'/,
    );

    assert.match(
      plan,
      /case 'need-to-save':[\s\S]*?setExpandedKey\('money'\)/,
    );
  },
);

test(
  'Plan Need to Save details explain the remaining cost gap',
  () => {
    assert.match(plan, /selectNeedToSave/);

    assert.match(
      plan,
      /const needToSave = useMemo[\s\S]*?selectNeedToSave\(workspace\)/,
    );

    assert.match(
      plan,
      /params\.focus === 'need-to-save'[\s\S]*?PlanStepCard[\s\S]*?stepKey="money"/,
    );

    assert.match(
      plan,
      /planNeedToSaveCalculation[\s\S]*?planNeedToSaveRemainingUnpaid[\s\S]*?remainingTotal[\s\S]*?readyMoney[\s\S]*?planNeedToSaveResult[\s\S]*?needToSave/,
    );

    assert.match(
      plan,
      /amount={`-\$\{formatAmount\([\s\S]*?readyMoney/,
    );

    assert.doesNotMatch(
      plan,
      /'Need to Save calculation'|'Remaining unpaid trip cost'|label=\{'Need to Save'\}/,
    );
  },
);

test(
  'Plan commitment deep links expand and highlight the commitments KPI',
  () => {
    assert.match(
      plan,
      /case 'commitments':[\s\S]*?case 'next-commitment':[\s\S]*?setExpandedKey\('commitments'\)/,
    );

    assert.match(
      plan,
      /JzFocusHighlight[\s\S]*?params\.focus === 'commitments'[\s\S]*?params\.focus === 'next-commitment'[\s\S]*?PlanStepCard[\s\S]*?stepKey="commitments"/,
    );
  },
);

test(
  'Bookings deep link highlights the payments booking overview',
  () => {
    assert.match(
      payments,
      /JzFocusHighlight[\s\S]*?params\.focus === 'bookings'[\s\S]*?styles\.overviewCard/,
    );
  },
);

test(
  'Bookings focus shows the booking balance details',
  () => {
    assert.match(
      payments,
      /params\.focus === 'bookings'[\s\S]*?styles\.overviewCard/,
    );

    assert.match(
      payments,
      /const remainingTotal = Math\.max\([\s\S]*?bookingTotal - paidTotal/,
    );

    assert.match(
      payments,
      /bookingBalanceCalculation[\s\S]*?paymentBookingTotal[\s\S]*?bookingTotal[\s\S]*?t\('paid'\)[\s\S]*?paidTotal[\s\S]*?todayBookingsLeftLabel[\s\S]*?remainingTotal/,
    );

    assert.match(
      payments,
      /bookingScheduledStillOutstanding[\s\S]*?scheduledTotal/,
    );
  },
);

test(
  'target highlight respects reduced-motion preference',
  () => {
    assert.match(
      highlight,
      /AccessibilityInfo[\s\S]*?isReduceMotionEnabled/,
    );

    assert.match(
      highlight,
      /if \(reduceMotion\)[\s\S]*?setTimeout/,
    );
  },
);

test(
  'Plan next payment carries the exact payment id through the shared focus contract',
  () => {
    assert.match(
      plan,
      /focus: 'next-payment',[\s\S]*?entityId: nextPayment\.id/,
    );

    assert.match(
      plan,
      /navigateTo\([\s\S]*?nextStep\.entityId/,
    );

    assert.match(
      payments,
      /params\.focus ===[\s\S]*?'next-payment'[\s\S]*?params\.id ===[\s\S]*?nextPayment\.id/,
    );
  },
);

test(
  'Plan preserves same-day group truth while Commitments focuses its exact next headline item',
  () => {
    assert.match(
      plan,
      /selectNextTripWindowCommitmentGroup/,
    );

    assert.match(
      plan,
      /nextCommitmentGroup[\s\S]*?totalAmount/,
    );

    assert.match(
      plan,
      /itemCount === 1[\s\S]*?entityId:[\s\S]*?items\[0\]\.id/,
    );

    assert.match(
      plan,
      /focus:[\s\S]*?'next-commitment'/,
    );

    assert.match(
      commitments,
      /const nextCommitment =[\s\S]*?nextCommitmentGroup\?\.items\[0\]/,
    );

    assert.match(
      commitments,
      /params\.focus ===[\s\S]*?'next-commitment'[\s\S]*?nextCommitment\.id === params\.id/,
    );

    assert.match(
      commitments,
      /JzFocusHighlight[\s\S]*?focusMatchesNextCommitment[\s\S]*?styles\.nextCard/,
    );
  },
);
