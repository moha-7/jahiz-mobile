import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const observer =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/product-metrics/jahiz-product-metrics-observer.tsx',
      import.meta.url,
    ),
    'utf8',
  );

const dates =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/create-trip/dates-screen.tsx',
      import.meta.url,
    ),
    'utf8',
  );

const moves =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/moves/moves-screen.tsx',
      import.meta.url,
    ),
    'utf8',
  );

const metrics =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/product-metrics/jahiz-product-metrics.ts',
      import.meta.url,
    ),
    'utf8',
  );

const providers =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/providers/app-providers.tsx',
      import.meta.url,
    ),
    'utf8',
  );

const envExample =
  fs.readFileSync(
    new URL(
      '../.env.example',
      import.meta.url,
    ),
    'utf8',
  );

test(
  'PMF metrics are explicitly opt-in and mounted without changing product authority',
  () => {
    assert.match(
      observer,
      /EXPO_PUBLIC_JAHIZ_PRODUCT_METRICS_ENABLED/,
    );

    assert.match(
      providers,
      /<JahizProductMetricsObserver\s*\/>/,
    );

    assert.match(
      envExample,
      /EXPO_PUBLIC_JAHIZ_PRODUCT_METRICS_ENABLED=0/,
    );

    assert.match(
      envExample,
      /EXPO_PUBLIC_JAHIZ_PRODUCT_METRICS_DIAGNOSTICS=0/,
    );
  },
);

test(
  'metrics schema cannot carry financial or identity payloads',
  () => {
    assert.doesNotMatch(
      metrics,
      /ownerId|accountId|email|currency|availableNow|totalCost|needToSave|destination|originAirport/i,
    );

    assert.deepEqual(
      [
        'planning_started',
        'create_step_seen',
        'verdict_seen',
        'moves_seen',
        'why_move_opened',
        'date_flexibility_fixed_saved',
        'date_flexibility_flexible_saved',
        'timing_better_available',
        'timing_review_dates_opened',
      ].every(
        (name) =>
          metrics.includes(
            `'${name}'`,
          ),
      ),
      true,
    );
  },
);

test(
  'observer measures funnel surfaces but never serializes the workspace or decision value',
  () => {
    assert.match(
      observer,
      /create_step_seen/,
    );
    assert.match(
      observer,
      /verdict_seen/,
    );
    assert.match(
      observer,
      /moves_seen/,
    );

    assert.doesNotMatch(
      observer,
      /record\([^)]*(workspace|summary|funds|amount|currency|decision\.reason)/s,
    );
  },
);

test(
  'Why-this-Move engagement records only the interaction, not the move payload',
  () => {
    assert.match(
      moves,
      /name:\s*'why_move_opened'/,
    );

    assert.doesNotMatch(
      moves,
      /record\(\{[^}]*move\.kind/s,
    );
    assert.doesNotMatch(
      moves,
      /record\(\{[^}]*impactAmount/s,
    );
  },
);

test(
  'saved date flexibility records only persisted option intent',
  () => {
    const saveStart =
      dates.indexOf('function saveDates()');
    const selectStart =
      dates.indexOf('function selectFlexibility(');
    const selectEnd =
      dates.indexOf('function selectDate(', selectStart);

    assert.ok(saveStart >= 0);
    assert.ok(selectStart > saveStart);
    assert.ok(selectEnd > selectStart);

    const saveSource =
      dates.slice(saveStart, selectStart);
    const selectSource =
      dates.slice(selectStart, selectEnd);

    assert.match(
      saveSource,
      /date_flexibility_(fixed|flexible)_saved|savedDateFlexibilityMetricName/,
    );

    assert.doesNotMatch(
      selectSource,
      /date_flexibility_(fixed|flexible)_saved|productMetricsStore\.record/,
    );

    const recordMatch =
      saveSource.match(
        /productMetricsStore\.record\(\{([\s\S]*?)\}\);/,
      );

    assert.ok(
      recordMatch,
      'Saving Dates must record one privacy-safe flexibility event.',
    );

    const recordSource =
      recordMatch?.[1] ?? '';

    assert.match(
      recordSource,
      /savedDateFlexibilityMetricName\([\s\S]*?parsedDates\.data\.flexibility/,
    );

    assert.match(
      recordSource,
      /step:\s*'dates'/,
    );

    assert.doesNotMatch(
      recordSource,
      /departureDate|returnDate|workspace|amount|currency|availableNow|destination|originAirport|ownerId|accountId|tripId|verdictValue|email/i,
    );
  },
);

test(
  'Better Timing engagement records interaction only and never timing or financial payload',
  () => {
    assert.match(
      moves,
      /name:\s*'timing_better_available'/,
    );

    assert.match(
      moves,
      /name:\s*'timing_review_dates_opened'/,
    );

    assert.match(
      moves,
      /timingGuidanceKind\s*!==\s*'better-timing'/,
    );

    assert.doesNotMatch(
      moves,
      /record\(\{[^}]*knownImprovement/s,
    );

    assert.doesNotMatch(
      moves,
      /record\(\{[^}]*proposedDepartureDate/s,
    );

    assert.doesNotMatch(
      moves,
      /record\(\{[^}]*offsetDays/s,
    );

    assert.doesNotMatch(
      moves,
      /record\(\{[^}]*workspace/s,
    );

    assert.doesNotMatch(
      moves,
      /record\(\{[^}]*amount/s,
    );

    assert.doesNotMatch(
      moves,
      /record\(\{[^}]*currency/s,
    );
  },
);
