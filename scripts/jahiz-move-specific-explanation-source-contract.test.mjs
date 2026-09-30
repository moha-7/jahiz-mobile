import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const movesScreen =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/moves/moves-screen.tsx',
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
  'expanded Why this Move renders move-specific deterministic copy instead of the generic helper',
  () => {
    assert.match(
      movesScreen,
      /const moveWhyCopy =/,
    );

    assert.match(
      movesScreen,
      /why=\{why\}/,
    );

    assert.match(
      movesScreen,
      /\{why\}/,
    );

    assert.doesNotMatch(
      movesScreen,
      /\{t\('movesWhyHelper'\)\}/,
    );
  },
);

test(
  'specific explanations cover every current Move kind',
  () => {
    for (
      const kind
      of [
        'overdue-commitment',
        'overdue-payment',
        'funding-gap',
        'bookings-left',
        'plan-incomplete',
        'review-spending',
        'review-moves',
        'trip-complete',
        'set-dates',
      ]
    ) {
      assert.match(
        movesScreen,
        new RegExp(
          `case '${kind}'`,
        ),
      );
    }
  },
);

test(
  'funding gap and incomplete plan explanations use the exact current decision inputs',
  () => {
    assert.match(
      movesScreen,
      /movesWhyFundingGap/,
    );

    assert.match(
      movesScreen,
      /move\.impactAmount \?\? 0/,
    );

    assert.match(
      movesScreen,
      /movesWhyPlanIncomplete/,
    );

    assert.match(
      movesScreen,
      /summary\.progress\s*\.percentage/,
    );
  },
);

test(
  'bilingual explanation copy preserves UNKNOWN-never-zero truth',
  () => {
    assert.match(
      i18n,
      /movesWhyPlanIncomplete: 'Your required setup is \{count\}% complete\. Missing inputs remain unknown rather than zero/,
    );

    assert.match(
      i18n,
      /movesWhyPlanIncomplete: 'اكتمل \{count\}% من الإعداد المطلوب\. البيانات الناقصة تفضل غير معروفة بدل صفر/,
    );

    assert.match(
      i18n,
      /movesWhySetDates: 'Without valid travel dates, Jahiz cannot place expected money, commitments and scheduled payments correctly on the trip timeline\.'/,
    );

    assert.match(
      i18n,
      /movesWhySetDates: 'من غير تواريخ سفر صحيحة، جاهز ما يقدرش يرتّب الدخل المتوقع والالتزامات والدفعات المجدولة صح على خط الرحلة الزمني\.'/,
    );
  },
);


test(
  'Moves wires deterministic timing guidance without changing ranked Move scoring',
  () => {
    assert.match(
      movesScreen,
      /buildMoveTripRecommendation/,
    );

    assert.match(
      movesScreen,
      /\[7, 14, 30\]/,
    );

    assert.match(
      movesScreen,
      /summary\.progress\.percentage < 100/,
    );

    assert.match(
      movesScreen,
      /workspace\.dates\.flexibility !==\s*'flexible'/,
    );

    assert.match(
      movesScreen,
      /<TimingGuidanceCard/,
    );
  },
);

test(
  'timing copy distinguishes fixed suppression, neutral no-improvement, and UNKNOWN repricing',
  () => {
    assert.match(
      i18n,
      /timingFixedTitle: 'Dates are fixed'/,
    );

    assert.match(
      i18n,
      /timingNoKnownImprovementTitle: 'No known timing improvement'/,
    );

    assert.match(
      i18n,
      /Missing facts remain unknown/,
    );

    // timingRecommendationSimple must not be rendered
    // because signed inflow/outflow deltas need distinct copy.
    assert.doesNotMatch(
      movesScreen,
      /timingRecommendationSimple/,
    );

    assert.match(
      i18n,
      /Their change is unknown, not zero/,
    );

    assert.match(
      i18n,
      /timingFixedTitle:/,
    );

    assert.match(
      i18n,
      /timingNoKnownImprovementHelper:/,
    );
  },
);
