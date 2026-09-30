import {
  JAHIZ_PRODUCT_METRICS_MAX_EVENTS,
  createEmptyJahizProductMetricsDocument,
  parseJahizProductMetricsDocument,
  summarizeJahizProductMetrics,
  type JahizProductMetricEvent,
  type JahizProductMetricName,
  type JahizProductMetricStep,
  type JahizProductMetricsDocument,
  type JahizProductMetricsSummary,
} from './jahiz-product-metrics';

export type JahizProductMetricsStorage = {
  getItemAsync: (
    key: string,
  ) => Promise<string | null>;
  setItemAsync: (
    key: string,
    value: string,
  ) => Promise<void>;
};

export type JahizProductMetricsStore = {
  startPlanningSession: (
    input?: {
      now?: string;
      sessionId?: string;
    },
  ) => Promise<string>;
  record: (
    input: {
      name:
        Exclude<
          JahizProductMetricName,
          'planning_started'
        >;
      step?:
        JahizProductMetricStep | null;
      now?: string;
    },
  ) => Promise<void>;
  load: () =>
    Promise<JahizProductMetricsDocument>;
  summary: () =>
    Promise<JahizProductMetricsSummary>;
  clear: () => Promise<void>;
};

const STORAGE_KEY =
  'jahiz.product-metrics.v1';

const SESSION_REUSE_WINDOW_MS =
  12 * 60 * 60 * 1000;

function defaultNow(): string {
  return new Date().toISOString();
}

function defaultSessionId(): string {
  return [
    'pmf',
    Date.now()
      .toString(36),
    Math.random()
      .toString(36)
      .slice(2, 12),
  ].join(':');
}

function eventId(
  sessionId: string,
  name: JahizProductMetricName,
  step:
    JahizProductMetricStep | null,
): string {
  return [
    sessionId,
    name,
    step ?? 'none',
  ].join('|');
}

function isSavedDateFlexibilityMetric(
  name: JahizProductMetricName,
): boolean {
  return (
    name ===
      'date_flexibility_fixed_saved' ||
    name ===
      'date_flexibility_flexible_saved'
  );
}

function appendUniqueEvent(
  document:
    JahizProductMetricsDocument,
  event:
    JahizProductMetricEvent,
): JahizProductMetricsDocument {
  const baseEvents =
    isSavedDateFlexibilityMetric(
      event.name,
    )
      ? document.events.filter(
          (current) =>
            current.sessionId !==
              event.sessionId ||
            !isSavedDateFlexibilityMetric(
              current.name,
            ),
        )
      : document.events;

  const exists =
    baseEvents.some(
      (current) =>
        current.eventId ===
          event.eventId,
    );

  if (exists) {
    return document;
  }

  return {
    ...document,
    events: [
      ...baseEvents,
      event,
    ].slice(
      -JAHIZ_PRODUCT_METRICS_MAX_EVENTS,
    ),
  };
}

export function createJahizProductMetricsStore(
  storage:
    JahizProductMetricsStorage,
): JahizProductMetricsStore {
  let tail:
    Promise<unknown> =
      Promise.resolve();

  function enqueue<T>(
    action:
      () => Promise<T>,
  ): Promise<T> {
    const run =
      tail.then(
        action,
        action,
      );

    tail =
      run.then(
        () => undefined,
        () => undefined,
      );

    return run;
  }

  async function loadDocument() {
    return parseJahizProductMetricsDocument(
      await storage.getItemAsync(
        STORAGE_KEY,
      ),
    );
  }

  async function saveDocument(
    document:
      JahizProductMetricsDocument,
  ) {
    await storage.setItemAsync(
      STORAGE_KEY,
      JSON.stringify(
        document,
      ),
    );
  }

  return {
    startPlanningSession(
      input = {},
    ) {
      return enqueue(
        async () => {
          const now =
            input.now ??
            defaultNow();

          let document =
            await loadDocument();

          const active =
            document.activeSession;

          const activeAge =
            active
              ? Date.parse(
                  now,
                ) -
                Date.parse(
                  active.startedAt,
                )
              : Number.POSITIVE_INFINITY;

          const canReuse =
            active !== null &&
            active.completedAt ===
              null &&
            activeAge >= 0 &&
            activeAge <=
              SESSION_REUSE_WINDOW_MS;

          if (canReuse) {
            return active.sessionId;
          }

          const sessionId =
            input.sessionId ??
            defaultSessionId();

          const session = {
            sessionId,
            startedAt: now,
            completedAt: null,
          };

          document = {
            ...document,
            activeSession:
              session,
          };

          document =
            appendUniqueEvent(
              document,
              {
                eventId:
                  eventId(
                    sessionId,
                    'planning_started',
                    null,
                  ),
                sessionId,
                name:
                  'planning_started',
                step: null,
                at: now,
              },
            );

          await saveDocument(
            document,
          );

          return sessionId;
        },
      );
    },

    record(input) {
      return enqueue(
        async () => {
          let document =
            await loadDocument();

          const session =
            document.activeSession;

          if (!session) {
            return;
          }

          const now =
            input.now ??
            defaultNow();

          document =
            appendUniqueEvent(
              document,
              {
                eventId:
                  eventId(
                    session.sessionId,
                    input.name,
                    input.step ??
                      null,
                  ),
                sessionId:
                  session.sessionId,
                name:
                  input.name,
                step:
                  input.step ??
                  null,
                at: now,
              },
            );

          if (
            input.name ===
              'verdict_seen' &&
            session.completedAt ===
              null
          ) {
            document = {
              ...document,
              activeSession: {
                ...session,
                completedAt:
                  now,
              },
            };
          }

          await saveDocument(
            document,
          );
        },
      );
    },

    load() {
      return enqueue(
        () =>
          loadDocument(),
      );
    },

    summary() {
      return enqueue(
        async () =>
          summarizeJahizProductMetrics(
            await loadDocument(),
          ),
      );
    },

    clear() {
      return enqueue(
        async () => {
          await saveDocument(
            createEmptyJahizProductMetricsDocument(),
          );
        },
      );
    },
  };
}
