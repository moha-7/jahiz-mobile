import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  getJahizProductMetricsStore,
} from './jahiz-product-metrics-secure-store';
import type {
  JahizProductMetricsSummary,
} from './jahiz-product-metrics';

const emptySummary:
  JahizProductMetricsSummary = {
    sessions: 0,
    verdictSessions: 0,
    verdictRatePercent: 0,
    medianTimeToVerdictMs:
      null,
    movesSeenSessions: 0,
    whyMoveOpenedSessions: 0,
    whyMoveOpenRatePercent: 0,
    savedDateFlexibilitySessions: 0,
    savedFixedDateSessions: 0,
    savedFlexibleDateSessions: 0,
    savedFlexibleDateRatePercent: 0,
    betterTimingAvailableSessions: 0,
    timingReviewDatesOpenedSessions: 0,
    timingReviewRatePercent: 0,
    stepReach: {
      route: 0,
      dates: 0,
      funds: 0,
      commitments: 0,
      costs: 0,
    },
  };

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metric}>
      <Text
        style={styles.metricLabel}
      >
        {label}
      </Text>
      <Text
        style={styles.metricValue}
      >
        {value}
      </Text>
    </View>
  );
}

function duration(
  milliseconds:
    number | null,
): string {
  if (
    milliseconds === null
  ) {
    return '--';
  }

  const totalSeconds =
    Math.max(
      0,
      Math.round(
        milliseconds / 1000,
      ),
    );

  const minutes =
    Math.floor(
      totalSeconds / 60,
    );

  const seconds =
    totalSeconds % 60;

  return [
    minutes,
    String(seconds)
      .padStart(2, '0'),
  ].join(':');
}

export function JahizProductMetricsDiagnosticsOverlay() {
  const visible =
    __DEV__ &&
    process.env
      .EXPO_PUBLIC_JAHIZ_PARTICIPANT_MODE !==
      '1' &&
    process.env
      .EXPO_PUBLIC_JAHIZ_PRODUCT_METRICS_DIAGNOSTICS ===
      '1';

  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    summary,
    setSummary,
  ] =
    useState<JahizProductMetricsSummary>(
      emptySummary,
    );

  const store =
    useMemo(
      () =>
        getJahizProductMetricsStore(),
      [],
    );

  useEffect(() => {
    if (!visible) {
      return;
    }

    let cancelled = false;

    const refresh =
      async () => {
        const next =
          await store.summary();

        if (!cancelled) {
          setSummary(next);
        }
      };

    void refresh();

    const interval =
      setInterval(
        () => {
          void refresh();
        },
        1_000,
      );

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    store,
    visible,
  ]);

  if (!visible) {
    return null;
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open Jahiz PMF metrics"
        onPress={() =>
          setOpen(true)
        }
        style={styles.floatingButton}
      >
        <Text
          style={styles.floatingText}
        >
          PMF
        </Text>
      </Pressable>

      <Modal
        animationType="slide"
        onRequestClose={() =>
          setOpen(false)
        }
        transparent
        visible={open}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <View>
                <Text
                  style={styles.title}
                >
                  PMF session metrics
                </Text>
                <Text
                  style={styles.subtitle}
                >
                  Development only | device-local
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  setOpen(false)
                }
                style={
                  styles.closeButton
                }
              >
                <Text
                  style={
                    styles.closeText
                  }
                >
                  Close
                </Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={
                styles.content
              }
            >
              <Metric
                label="Planning sessions"
                value={String(
                  summary.sessions,
                )}
              />
              <Metric
                label="Reached verdict"
                value={
                  `${summary.verdictSessions} | ${summary.verdictRatePercent}%`
                }
              />
              <Metric
                label="Median time to verdict"
                value={duration(
                  summary.medianTimeToVerdictMs,
                )}
              />
              <Metric
                label="Reached Moves"
                value={String(
                  summary.movesSeenSessions,
                )}
              />
              <Metric
                label="Opened Why this Move"
                value={
                  `${summary.whyMoveOpenedSessions} | ${summary.whyMoveOpenRatePercent}% of Moves sessions`
                }
              />

              <View
                style={
                  styles.block
                }
              >
                <Text
                  style={
                    styles.blockTitle
                  }
                >
                  Better timing engagement
                </Text>

                <Metric
                  label="Available"
                  value={String(
                    summary.betterTimingAvailableSessions,
                  )}
                />
                <Metric
                  label="Opened Review dates"
                  value={
                    `${summary.timingReviewDatesOpenedSessions} | ${summary.timingReviewRatePercent}% of available sessions`
                  }
                />
              </View>
              <View
                style={
                  styles.block
                }
              >
                <Text
                  style={
                    styles.blockTitle
                  }
                >
                  Saved date flexibility
                </Text>

                <Metric
                  label="Saved choices"
                  value={String(
                    summary.savedDateFlexibilitySessions,
                  )}
                />
                <Metric
                  label="Fixed"
                  value={String(
                    summary.savedFixedDateSessions,
                  )}
                />
                <Metric
                  label="Flexible"
                  value={String(
                    summary.savedFlexibleDateSessions,
                  )}
                />
                <Metric
                  label="Flexible share"
                  value={
                    `${summary.savedFlexibleDateRatePercent}%`
                  }
                />
              </View>

              <View
                style={
                  styles.block
                }
              >
                <Text
                  style={
                    styles.blockTitle
                  }
                >
                  Funnel reach
                </Text>

                {Object.entries(
                  summary.stepReach,
                ).map(
                  ([
                    step,
                    count,
                  ]) => (
                    <Metric
                      key={step}
                      label={step}
                      value={String(
                        count,
                      )}
                    />
                  ),
                )}
              </View>

              <Text
                style={
                  styles.footer
                }
              >
                No account ID, trip ID, route, currency, amount, verdict value, or financial payload is stored.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles =
  StyleSheet.create({
    floatingButton: {
      position: 'absolute',
      right: 12,
      top: 92,
      zIndex: 9999,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor:
        'rgba(15, 23, 42, 0.92)',
      borderWidth: 1,
      borderColor:
        'rgba(96, 165, 250, 0.55)',
    },
    floatingText: {
      color: '#bfdbfe',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.7,
    },
    backdrop: {
      flex: 1,
      justifyContent:
        'flex-end',
      backgroundColor:
        'rgba(2, 6, 23, 0.62)',
    },
    sheet: {
      maxHeight: '82%',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      backgroundColor: '#0f172a',
      paddingTop: 18,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      paddingHorizontal: 20,
      paddingBottom: 14,
    },
    title: {
      color: '#f8fafc',
      fontSize: 20,
      fontWeight: '800',
    },
    subtitle: {
      color: '#94a3b8',
      fontSize: 12,
      marginTop: 4,
    },
    closeButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: '#1e293b',
    },
    closeText: {
      color: '#e2e8f0',
      fontWeight: '700',
    },
    content: {
      paddingHorizontal: 20,
      paddingBottom: 32,
      gap: 10,
    },
    metric: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      gap: 16,
      paddingVertical: 12,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor: '#334155',
    },
    metricLabel: {
      color: '#94a3b8',
      flex: 1,
      textTransform: 'capitalize',
    },
    metricValue: {
      color: '#f8fafc',
      fontWeight: '700',
      textAlign: 'right',
      flex: 1,
    },
    block: {
      marginTop: 8,
      padding: 14,
      borderRadius: 18,
      backgroundColor: '#111c31',
    },
    blockTitle: {
      color: '#f8fafc',
      fontWeight: '800',
      marginBottom: 4,
    },
    footer: {
      color: '#64748b',
      fontSize: 12,
      textAlign: 'center',
      marginTop: 10,
      lineHeight: 18,
    },
  });
