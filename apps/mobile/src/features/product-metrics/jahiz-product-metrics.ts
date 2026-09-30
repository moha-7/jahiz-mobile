export type JahizProductMetricName =
  | 'planning_started'
  | 'create_step_seen'
  | 'verdict_seen'
  | 'moves_seen'
  | 'why_move_opened'
  | 'date_flexibility_fixed_saved'
  | 'date_flexibility_flexible_saved'
  | 'timing_better_available'
  | 'timing_review_dates_opened';

export type JahizProductMetricStep =
  | 'route'
  | 'dates'
  | 'funds'
  | 'commitments'
  | 'costs';

export type JahizProductMetricEvent = {
  eventId: string;
  sessionId: string;
  name: JahizProductMetricName;
  step: JahizProductMetricStep | null;
  at: string;
};

export type JahizProductMetricSession = {
  sessionId: string;
  startedAt: string;
  completedAt: string | null;
};

export type JahizProductMetricsDocument = {
  version: 1;
  activeSession:
    JahizProductMetricSession | null;
  events:
    JahizProductMetricEvent[];
};

export type JahizProductMetricsSummary = {
  sessions: number;
  verdictSessions: number;
  verdictRatePercent: number;
  medianTimeToVerdictMs: number | null;
  movesSeenSessions: number;
  whyMoveOpenedSessions: number;
  whyMoveOpenRatePercent: number;
  savedDateFlexibilitySessions: number;
  savedFixedDateSessions: number;
  savedFlexibleDateSessions: number;
  savedFlexibleDateRatePercent: number;
  betterTimingAvailableSessions: number;
  timingReviewDatesOpenedSessions: number;
  timingReviewRatePercent: number;
  stepReach: Record<
    JahizProductMetricStep,
    number
  >;
};

export const JAHIZ_PRODUCT_METRICS_MAX_EVENTS =
  500;

export function createEmptyJahizProductMetricsDocument():
  JahizProductMetricsDocument {
  return {
    version: 1,
    activeSession: null,
    events: [],
  };
}

export function isJahizProductMetricName(
  value: unknown,
): value is JahizProductMetricName {
  return (
    value === 'planning_started' ||
    value === 'create_step_seen' ||
    value === 'verdict_seen' ||
    value === 'moves_seen' ||
    value === 'why_move_opened' ||
    value === 'date_flexibility_fixed_saved' ||
    value === 'date_flexibility_flexible_saved' ||
    value === 'timing_better_available' ||
    value === 'timing_review_dates_opened'
  );
}

export function isJahizProductMetricStep(
  value: unknown,
): value is JahizProductMetricStep {
  return (
    value === 'route' ||
    value === 'dates' ||
    value === 'funds' ||
    value === 'commitments' ||
    value === 'costs'
  );
}

function isIsoDateTime(
  value: unknown,
): value is string {
  return (
    typeof value === 'string' &&
    !Number.isNaN(
      Date.parse(value),
    )
  );
}

export function parseJahizProductMetricsDocument(
  raw: string | null,
): JahizProductMetricsDocument {
  if (!raw) {
    return createEmptyJahizProductMetricsDocument();
  }

  try {
    const candidate =
      JSON.parse(raw) as {
        version?: unknown;
        activeSession?: unknown;
        events?: unknown;
      };

    if (
      candidate.version !== 1 ||
      !Array.isArray(
        candidate.events,
      )
    ) {
      return createEmptyJahizProductMetricsDocument();
    }

    const events =
      candidate.events.flatMap(
        (entry) => {
          if (
            !entry ||
            typeof entry !==
              'object'
          ) {
            return [];
          }

          const value =
            entry as Partial<JahizProductMetricEvent>;

          if (
            typeof value.eventId !==
              'string' ||
            typeof value.sessionId !==
              'string' ||
            !isJahizProductMetricName(
              value.name,
            ) ||
            !isIsoDateTime(
              value.at,
            )
          ) {
            return [];
          }

          if (
            value.step !== null &&
            value.step !==
              undefined &&
            !isJahizProductMetricStep(
              value.step,
            )
          ) {
            return [];
          }

          return [
            {
              eventId:
                value.eventId,
              sessionId:
                value.sessionId,
              name: value.name,
              step:
                value.step ?? null,
              at: value.at,
            },
          ];
        },
      );

    let activeSession:
      JahizProductMetricSession | null =
        null;

    if (
      candidate.activeSession &&
      typeof candidate.activeSession ===
        'object'
    ) {
      const value =
        candidate.activeSession as Partial<JahizProductMetricSession>;

      if (
        typeof value.sessionId ===
          'string' &&
        isIsoDateTime(
          value.startedAt,
        ) &&
        (
          value.completedAt ===
            null ||
          isIsoDateTime(
            value.completedAt,
          )
        )
      ) {
        activeSession = {
          sessionId:
            value.sessionId,
          startedAt:
            value.startedAt,
          completedAt:
            value.completedAt ??
            null,
        };
      }
    }

    return {
      version: 1,
      activeSession,
      events:
        events.slice(
          -JAHIZ_PRODUCT_METRICS_MAX_EVENTS,
        ),
    };
  } catch {
    return createEmptyJahizProductMetricsDocument();
  }
}

function percent(
  numerator: number,
  denominator: number,
): number {
  if (denominator === 0) {
    return 0;
  }

  return Math.round(
    (numerator /
      denominator) *
      100,
  );
}

function median(
  values: number[],
): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [
    ...values,
  ].sort(
    (left, right) =>
      left - right,
  );

  const middle =
    Math.floor(
      sorted.length / 2,
    );

  return sorted.length % 2 ===
    0
    ? Math.round(
        (
          sorted[
            middle - 1
          ] +
          sorted[middle]
        ) / 2,
      )
    : sorted[middle];
}

export function summarizeJahizProductMetrics(
  document:
    JahizProductMetricsDocument,
): JahizProductMetricsSummary {
  const starts =
    document.events.filter(
      (event) =>
        event.name ===
        'planning_started',
    );

  const sessionIds =
    new Set(
      starts.map(
        (event) =>
          event.sessionId,
      ),
    );

  const verdictIds =
    new Set(
      document.events
        .filter(
          (event) =>
            event.name ===
              'verdict_seen' &&
            sessionIds.has(
              event.sessionId,
            ),
        )
        .map(
          (event) =>
            event.sessionId,
        ),
    );

  const movesIds =
    new Set(
      document.events
        .filter(
          (event) =>
            event.name ===
              'moves_seen' &&
            sessionIds.has(
              event.sessionId,
            ),
        )
        .map(
          (event) =>
            event.sessionId,
        ),
    );

  const whyIds =
    new Set(
      document.events
        .filter(
          (event) =>
            event.name ===
              'why_move_opened' &&
            sessionIds.has(
              event.sessionId,
            ),
        )
        .map(
          (event) =>
            event.sessionId,
        ),
    );

  const betterTimingAvailableIds =
    new Set(
      document.events
        .filter(
          (event) =>
            event.name ===
              'timing_better_available' &&
            sessionIds.has(
              event.sessionId,
            ),
        )
        .map(
          (event) =>
            event.sessionId,
        ),
    );

  const timingReviewIds =
    new Set(
      document.events
        .filter(
          (event) =>
            event.name ===
              'timing_review_dates_opened' &&
            betterTimingAvailableIds.has(
              event.sessionId,
            ),
        )
        .map(
          (event) =>
            event.sessionId,
        ),
    );

  const savedDateFlexibilityBySession =
    new Map<
      string,
      'fixed' | 'flexible'
    >();

  for (const event of document.events) {
    if (!sessionIds.has(event.sessionId)) {
      continue;
    }

    if (
      event.name ===
      'date_flexibility_fixed_saved'
    ) {
      savedDateFlexibilityBySession.set(
        event.sessionId,
        'fixed',
      );
    }

    if (
      event.name ===
      'date_flexibility_flexible_saved'
    ) {
      savedDateFlexibilityBySession.set(
        event.sessionId,
        'flexible',
      );
    }
  }

  const savedDateFlexibilitySessions =
    savedDateFlexibilityBySession.size;

  const savedFixedDateSessions =
    Array.from(
      savedDateFlexibilityBySession.values(),
    ).filter(
      (value) => value === 'fixed',
    ).length;

  const savedFlexibleDateSessions =
    savedDateFlexibilitySessions -
    savedFixedDateSessions;

  const startBySession =    new Map(
      starts.map(
        (event) => [
          event.sessionId,
          Date.parse(
            event.at,
          ),
        ],
      ),
    );

  const timeToVerdict =
    document.events
      .filter(
        (event) =>
          event.name ===
            'verdict_seen',
      )
      .flatMap(
        (event) => {
          const start =
            startBySession.get(
              event.sessionId,
            );

          if (
            start === undefined
          ) {
            return [];
          }

          const elapsed =
            Date.parse(
              event.at,
            ) - start;

          return elapsed >= 0
            ? [elapsed]
            : [];
        },
      );

  const stepReach:
    Record<
      JahizProductMetricStep,
      number
    > = {
      route: 0,
      dates: 0,
      funds: 0,
      commitments: 0,
      costs: 0,
    };

  for (
    const step
    of Object.keys(
      stepReach,
    ) as JahizProductMetricStep[]
  ) {
    const ids =
      new Set(
        document.events
          .filter(
            (event) =>
              event.name ===
                'create_step_seen' &&
              event.step ===
                step &&
              sessionIds.has(
                event.sessionId,
              ),
          )
          .map(
            (event) =>
              event.sessionId,
          ),
      );

    stepReach[step] =
      ids.size;
  }

  return {
    sessions:
      sessionIds.size,
    verdictSessions:
      verdictIds.size,
    verdictRatePercent:
      percent(
        verdictIds.size,
        sessionIds.size,
      ),
    medianTimeToVerdictMs:
      median(
        timeToVerdict,
      ),
    movesSeenSessions:
      movesIds.size,
    whyMoveOpenedSessions:
      whyIds.size,
    whyMoveOpenRatePercent:
      percent(
        whyIds.size,
        movesIds.size,
      ),
    betterTimingAvailableSessions:
      betterTimingAvailableIds.size,
    timingReviewDatesOpenedSessions:
      timingReviewIds.size,
    timingReviewRatePercent:
      percent(
        timingReviewIds.size,
        betterTimingAvailableIds.size,
      ),
    savedDateFlexibilitySessions,
    savedFixedDateSessions,
    savedFlexibleDateSessions,
    savedFlexibleDateRatePercent:
      percent(
        savedFlexibleDateSessions,
        savedDateFlexibilitySessions,
      ),
    stepReach,
  };
}
