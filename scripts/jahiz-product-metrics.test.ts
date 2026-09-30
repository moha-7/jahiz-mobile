import assert from 'node:assert/strict';
import test from 'node:test';

import {
  JAHIZ_PRODUCT_METRICS_MAX_EVENTS,
  parseJahizProductMetricsDocument,
  summarizeJahizProductMetrics,
} from '../apps/mobile/src/features/product-metrics/jahiz-product-metrics.ts';

import {
  createJahizProductMetricsStore,
} from '../apps/mobile/src/features/product-metrics/jahiz-product-metrics-store.ts';

function memoryStorage() {
  let raw:
    string | null = null;

  return {
    storage: {
      async getItemAsync() {
        return raw;
      },
      async setItemAsync(
        _key: string,
        value: string,
      ) {
        raw = value;
      },
    },
    readRaw() {
      return raw;
    },
  };
}

test(
  'planning funnel records only allowlisted privacy-safe fields',
  async () => {
    const memory =
      memoryStorage();

    const store =
      createJahizProductMetricsStore(
        memory.storage,
      );

    await store.startPlanningSession({
      now:
        '2026-09-02T12:00:00.000Z',
      sessionId:
        'pmf-session-a',
    });

    await store.record({
      name:
        'create_step_seen',
      step: 'route',
      now:
        '2026-09-02T12:00:05.000Z',
    });

    await store.record({
      name:
        'date_flexibility_fixed_saved',
      step: 'dates',
      now:
        '2026-09-02T12:00:10.000Z',
    });

    await store.record({
      name:
        'date_flexibility_flexible_saved',
      step: 'dates',
      now:
        '2026-09-02T12:00:15.000Z',
    });

    await store.record({
      name:
        'verdict_seen',
      now:
        '2026-09-02T12:05:00.000Z',
    });

    await store.record({
      name:
        'moves_seen',
      now:
        '2026-09-02T12:05:10.000Z',
    });

    await store.record({
      name:
        'why_move_opened',
      now:
        '2026-09-02T12:05:20.000Z',
    });

    const raw =
      memory.readRaw();

    assert.ok(raw);

    const parsed =
      JSON.parse(
        raw ?? '{}',
      ) as {
        events?: unknown[];
      };

    assert.equal(
      parsed.events?.length,
      6,
    );

    for (
      const event
      of parsed.events ?? []
    ) {
      assert.deepEqual(
        Object.keys(
          event as object,
        ).sort(),
        [
          'at',
          'eventId',
          'name',
          'sessionId',
          'step',
        ],
      );
    }

    assert.doesNotMatch(
      raw ?? '',
      /ownerId|accountId|tripId|currency|amount|availableNow|destination|originAirport|verdictValue|email/i,
    );
  },
);

test(
  'summary measures verdict reach median time and Why-this-Move engagement',
  async () => {
    const memory =
      memoryStorage();

    const store =
      createJahizProductMetricsStore(
        memory.storage,
      );

    await store.startPlanningSession({
      now:
        '2026-09-02T08:00:00.000Z',
      sessionId:
        'pmf-session-1',
    });
    await store.record({
      name:
        'create_step_seen',
      step: 'route',
      now:
        '2026-09-02T08:00:10.000Z',
    });
    await store.record({
      name:
        'create_step_seen',
      step: 'dates',
      now:
        '2026-09-02T08:01:00.000Z',
    });
    await store.record({
      name:
        'verdict_seen',
      now:
        '2026-09-02T08:05:00.000Z',
    });
    await store.record({
      name:
        'moves_seen',
      now:
        '2026-09-02T08:05:10.000Z',
    });
    await store.record({
      name:
        'why_move_opened',
      now:
        '2026-09-02T08:05:20.000Z',
    });

    await store.startPlanningSession({
      now:
        '2026-09-03T08:00:00.000Z',
      sessionId:
        'pmf-session-2',
    });
    await store.record({
      name:
        'create_step_seen',
      step: 'route',
      now:
        '2026-09-03T08:00:10.000Z',
    });
    await store.record({
      name:
        'verdict_seen',
      now:
        '2026-09-03T08:09:00.000Z',
    });
    await store.record({
      name:
        'moves_seen',
      now:
        '2026-09-03T08:09:10.000Z',
    });

    await store.startPlanningSession({
      now:
        '2026-09-04T08:00:00.000Z',
      sessionId:
        'pmf-session-3',
    });
    await store.record({
      name:
        'create_step_seen',
      step: 'route',
      now:
        '2026-09-04T08:00:10.000Z',
    });

    const summary =
      await store.summary();

    assert.equal(
      summary.sessions,
      3,
    );
    assert.equal(
      summary.verdictSessions,
      2,
    );
    assert.equal(
      summary.verdictRatePercent,
      67,
    );
    assert.equal(
      summary.medianTimeToVerdictMs,
      7 * 60 * 1000,
    );
    assert.equal(
      summary.movesSeenSessions,
      2,
    );
    assert.equal(
      summary.whyMoveOpenedSessions,
      1,
    );
    assert.equal(
      summary.whyMoveOpenRatePercent,
      50,
    );
    assert.deepEqual(
      summary.stepReach,
      {
        route: 3,
        dates: 1,
        funds: 0,
        commitments: 0,
        costs: 0,
      },
    );
  },
);

test(
  'duplicate route renders do not inflate a session funnel',
  async () => {
    const memory =
      memoryStorage();

    const store =
      createJahizProductMetricsStore(
        memory.storage,
      );

    const first =
      await store.startPlanningSession({
        now:
          '2026-09-02T09:00:00.000Z',
        sessionId:
          'pmf-session-dedupe',
      });

    const second =
      await store.startPlanningSession({
        now:
          '2026-09-02T09:05:00.000Z',
        sessionId:
          'ignored-session-id',
      });

    assert.equal(
      second,
      first,
    );

    await store.record({
      name:
        'create_step_seen',
      step: 'route',
      now:
        '2026-09-02T09:00:10.000Z',
    });

    await store.record({
      name:
        'create_step_seen',
      step: 'route',
      now:
        '2026-09-02T09:00:20.000Z',
    });

    const document =
      await store.load();

    assert.equal(
      document.events.filter(
        (event) =>
          event.name ===
          'planning_started',
      ).length,
      1,
    );

    assert.equal(
      document.events.filter(
        (event) =>
          event.name ===
            'create_step_seen' &&
          event.step ===
            'route',
      ).length,
      1,
    );
  },
);

test(
  'a completed verdict session does not block post-verdict Moves engagement',
  async () => {
    const memory =
      memoryStorage();

    const store =
      createJahizProductMetricsStore(
        memory.storage,
      );

    await store.startPlanningSession({
      now:
        '2026-09-02T10:00:00.000Z',
      sessionId:
        'pmf-session-post-verdict',
    });

    await store.record({
      name:
        'verdict_seen',
      now:
        '2026-09-02T10:04:00.000Z',
    });

    await store.record({
      name:
        'moves_seen',
      now:
        '2026-09-02T10:04:10.000Z',
    });

    await store.record({
      name:
        'why_move_opened',
      now:
        '2026-09-02T10:04:20.000Z',
    });

    const summary =
      await store.summary();

    assert.equal(
      summary.movesSeenSessions,
      1,
    );
    assert.equal(
      summary.whyMoveOpenedSessions,
      1,
    );
  },
);

test(
  'starting route after a completed session creates a new planning session',
  async () => {
    const memory =
      memoryStorage();

    const store =
      createJahizProductMetricsStore(
        memory.storage,
      );

    await store.startPlanningSession({
      now:
        '2026-09-02T11:00:00.000Z',
      sessionId:
        'pmf-session-old',
    });

    await store.record({
      name:
        'verdict_seen',
      now:
        '2026-09-02T11:05:00.000Z',
    });

    const next =
      await store.startPlanningSession({
        now:
          '2026-09-02T11:10:00.000Z',
      sessionId:
        'pmf-session-new',
    });

    assert.equal(
      next,
      'pmf-session-new',
    );

    const summary =
      await store.summary();

    assert.equal(
      summary.sessions,
      2,
    );
  },
);

test(
  'malformed payloads fail closed and stored history remains bounded',
  () => {
    const malformed =
      parseJahizProductMetricsDocument(
        JSON.stringify({
          version: 1,
          activeSession: {
            sessionId:
              'bad-session',
            startedAt:
              'not-a-date',
            completedAt:
              null,
          },
          events: [
            {
              eventId: 'bad',
              sessionId:
                'bad-session',
              name:
                'financial_amount',
              step: null,
              at:
                '2026-09-02T12:00:00.000Z',
            },
          ],
        }),
      );

    assert.equal(
      malformed.events.length,
      0,
    );
    assert.equal(
      malformed.activeSession,
      null,
    );

    const manyEvents =
      Array.from(
        {
          length:
            JAHIZ_PRODUCT_METRICS_MAX_EVENTS +
            50,
        },
        (
          _,
          index,
        ) => ({
          eventId:
            `event-${index}`,
          sessionId:
            `session-${index}`,
          name:
            'planning_started' as const,
          step: null,
          at:
            new Date(
              Date.UTC(
                2026,
                8,
                2,
                0,
                index,
              ),
            ).toISOString(),
        }),
      );

    const bounded =
      parseJahizProductMetricsDocument(
        JSON.stringify({
          version: 1,
          activeSession: null,
          events:
            manyEvents,
        }),
      );

    assert.equal(
      bounded.events.length,
      JAHIZ_PRODUCT_METRICS_MAX_EVENTS,
    );
  },
);

test(
  'summary ignores events without a planning-session start',
  () => {
    const summary =
      summarizeJahizProductMetrics({
        version: 1,
        activeSession: null,
        events: [
          {
            eventId:
              'orphan|verdict_seen|none',
            sessionId:
              'orphan',
            name:
              'verdict_seen',
            step: null,
            at:
              '2026-09-02T12:00:00.000Z',
          },
        ],
      });

    assert.equal(
      summary.sessions,
      0,
    );
    assert.equal(
      summary.verdictSessions,
      0,
    );
    assert.equal(
      summary.verdictRatePercent,
      0,
    );
  },
);

test(
  'saved date flexibility keeps only the latest persisted mode per planning session',
  async () => {
    const memory = memoryStorage();
    const store =
      createJahizProductMetricsStore(
        memory.storage,
      );

    await store.startPlanningSession({
      now: '2026-09-10T08:00:00.000Z',
      sessionId: 'pmf-date-mode',
    });

    await store.record({
      name: 'date_flexibility_fixed_saved',
      step: 'dates',
      now: '2026-09-10T08:01:00.000Z',
    });

    await store.record({
      name: 'date_flexibility_flexible_saved',
      step: 'dates',
      now: '2026-09-10T08:02:00.000Z',
    });

    await store.record({
      name: 'date_flexibility_fixed_saved',
      step: 'dates',
      now: '2026-09-10T08:03:00.000Z',
    });

    const document = await store.load();
    const dateEvents =
      document.events.filter(
        (event) =>
          event.name ===
            'date_flexibility_fixed_saved' ||
          event.name ===
            'date_flexibility_flexible_saved',
      );

    assert.equal(dateEvents.length, 1);
    assert.equal(
      dateEvents[0]?.name,
      'date_flexibility_fixed_saved',
    );
    assert.equal(
      dateEvents[0]?.at,
      '2026-09-10T08:03:00.000Z',
    );

    const summary = await store.summary();

    assert.equal(
      summary.savedDateFlexibilitySessions,
      1,
    );
    assert.equal(
      summary.savedFixedDateSessions,
      1,
    );
    assert.equal(
      summary.savedFlexibleDateSessions,
      0,
    );
    assert.equal(
      summary.savedFlexibleDateRatePercent,
      0,
    );
  },
);

test(
  'Better Timing availability is session-deduped and review rate uses available sessions',
  async () => {
    const memory =
      memoryStorage();

    const store =
      createJahizProductMetricsStore(
        memory.storage,
      );

    await store.startPlanningSession({
      now:
        '2026-09-10T09:00:00.000Z',
      sessionId:
        'pmf-timing-a',
    });

    await store.record({
      name:
        'timing_better_available',
      now:
        '2026-09-10T09:01:00.000Z',
    });

    await store.record({
      name:
        'timing_better_available',
      now:
        '2026-09-10T09:01:10.000Z',
    });

    await store.record({
      name:
        'timing_review_dates_opened',
      now:
        '2026-09-10T09:02:00.000Z',
    });

    await store.record({
      name:
        'timing_review_dates_opened',
      now:
        '2026-09-10T09:02:10.000Z',
    });

    await store.record({
      name:
        'verdict_seen',
      now:
        '2026-09-10T09:03:00.000Z',
    });

    await store.startPlanningSession({
      now:
        '2026-09-11T09:00:00.000Z',
      sessionId:
        'pmf-timing-b',
    });

    await store.record({
      name:
        'timing_better_available',
      now:
        '2026-09-11T09:01:00.000Z',
    });

    const summary =
      await store.summary();

    assert.equal(
      summary.betterTimingAvailableSessions,
      2,
    );

    assert.equal(
      summary.timingReviewDatesOpenedSessions,
      1,
    );

    assert.equal(
      summary.timingReviewRatePercent,
      50,
    );
  },
);
