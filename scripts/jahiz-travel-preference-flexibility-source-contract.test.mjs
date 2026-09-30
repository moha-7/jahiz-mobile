import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const dates =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/create-trip/dates-screen.tsx',
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
  'Dates critical path does not ask for a dormant travel preference',
  () => {
    assert.doesNotMatch(
      dates,
      /travelStyleTitle|travelStyleBudget|travelStyleSmart|travelStyleComfort|travelStylePremium/,
    );

    assert.doesNotMatch(
      dates,
      /TripTravelStyle|selectTravelStyle|travelStyleExplicitlySelected/,
    );
  },
);

test(
  'saving Dates changes dates only and does not mutate the trip profile',
  () => {
    assert.match(
      dates,
      /setWorkspaceDates\(parsedDates\.data\)/,
    );

    assert.doesNotMatch(
      dates,
      /setTripProfile/,
    );
  },
);

test(
  'date flexibility copy matches the current deterministic later-date comparison behavior',
  () => {
    assert.match(
      i18n,
      /dateFlexibilityHelper: 'Choose fixed when your dates cannot move\.[^']*7, 14 or 30 days later[^']*using your money timing[^']*never assumes cheaper flight prices\.'/,
    );

    assert.match(
      i18n,
      /fixedDates: 'I cannot move these dates'/,
    );

    assert.match(
      i18n,
      /flexibleDates: 'I can travel later'/,
    );
  },
);

test(
  'dormant Smart copy is presented as a default, not a recommendation',
  () => {
    assert.match(
      i18n,
      /travelStyleRecommended: 'Default'/,
    );

    assert.match(
      i18n,
      /travelStyleRecommended: '\\u0627\\u0641\\u062a\\u0631\\u0627\\u0636\\u064a'/,
    );

    assert.doesNotMatch(
      i18n,
      /travelStyleRecommended: 'Recommended'|travelStyleRecommended: '\\u0645\\u0642\\u062a\\u0631\\u062d'/,
    );

    assert.match(
      i18n,
      /travelStyleHelper: 'Optional\.[^']*does not recommend a style from your financial data yet[^']*does not change Ready Money today\.'/
    );
  },
);

test(
  'dormant travel preference copy remains non-recommendation language if reused later',
  () => {
    assert.match(
      i18n,
      /travelStyleTitle: 'Travel preference'/,
    );

    assert.match(
      i18n,
      /travelStyleHelper: 'Optional\.[^']*does not recommend a style from your financial data yet[^']*does not change Ready Money today\.'/,
    );
  },
);
