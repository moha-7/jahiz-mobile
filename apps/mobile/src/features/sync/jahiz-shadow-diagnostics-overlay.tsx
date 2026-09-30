import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  createEmptyShadowParityEvidence,
  type ShadowParityEvidence,
} from './jahiz-shadow-parity-evidence';

import {
  buildShadowDiagnosticsViewModel,
} from './jahiz-shadow-diagnostics-model';

import {
  createSecureShadowParityEvidenceStore,
} from './jahiz-shadow-parity-evidence-secure-store';

import {
  resolveShadowObserveConfig,
} from './jahiz-shadow-sync-observe-config';

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>
        {label}
      </Text>
      <Text style={styles.metricValue}>
        {value}
      </Text>
    </View>
  );
}

export function JahizShadowDiagnosticsOverlay() {
  const visible =
    __DEV__ &&
    process.env
      .EXPO_PUBLIC_JAHIZ_PARTICIPANT_MODE !==
      '1' &&
    process.env
      .EXPO_PUBLIC_JAHIZ_SHADOW_DIAGNOSTICS ===
      '1';

  const [open, setOpen] =
    useState(false);

  const [evidence, setEvidence] =
    useState<ShadowParityEvidence>(
      createEmptyShadowParityEvidence(),
    );

  const config =
    useMemo(
      () =>
        resolveShadowObserveConfig({
          isDevelopment:
            __DEV__,
          platform:
            Platform.OS,
          enabledFlag:
            process.env
              .EXPO_PUBLIC_JAHIZ_SHADOW_OBSERVE,
          baseUrl:
            process.env
              .EXPO_PUBLIC_JAHIZ_SHADOW_API_URL,
          devOwnerId:
            process.env
              .EXPO_PUBLIC_JAHIZ_SHADOW_DEV_OWNER,
        }),
      [],
    );

  const evidenceStore =
    useMemo(
      () =>
        createSecureShadowParityEvidenceStore(),
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
          await evidenceStore.load();

        if (!cancelled) {
          setEvidence(next);
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
    evidenceStore,
    visible,
  ]);

  const model =
    buildShadowDiagnosticsViewModel(
      config,
      evidence,
    );

  if (!visible) {
    return null;
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open Jahiz shadow diagnostics"
        onPress={() =>
          setOpen(true)
        }
        style={styles.floatingButton}
      >
        <Text style={styles.floatingText}>
          SHADOW
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
                <Text style={styles.title}>
                  Shadow diagnostics
                </Text>
                <Text style={styles.subtitle}>
                  Development only · authority stays local
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  setOpen(false)
                }
                style={styles.closeButton}
              >
                <Text style={styles.closeText}>
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
                label="Observe"
                value={
                  model.observeStatus ===
                  'enabled'
                    ? 'Enabled'
                    : `Disabled · ${
                        model.observeReason ??
                        'unknown'
                      }`
                }
              />

              <Metric
                label="Review gate"
                value={
                  model.reviewStatus ===
                  'eligible-for-review'
                    ? 'Eligible for review'
                    : 'Blocked'
                }
              />

              <Metric
                label="Sessions"
                value={String(
                  model.sessions,
                )}
              />

              <Metric
                label="Observations"
                value={String(
                  model.observations,
                )}
              />

              <Metric
                label="Parity checks"
                value={String(
                  model.parityComparisons,
                )}
              />

              <Metric
                label="Parity unknown"
                value={String(
                  model.parityUnknown,
                )}
              />

              <Metric
                label="Parity same"
                value={`${model.paritySamePercent}%`}
              />

              <Metric
                label="Conflict"
                value={`${model.conflictPercent}%`}
              />

              <Metric
                label="Unavailable"
                value={`${model.unavailablePercent}%`}
              />

              <Metric
                label="Bootstrap divergence"
                value={String(
                  model.bootstrapDivergences,
                )}
              />

              <Metric
                label="Server divergence"
                value={String(
                  model.serverDivergences,
                )}
              />

              <Metric
                label="Invalid responses"
                value={String(
                  model.invalidResponses,
                )}
              />

              <Metric
                label="Unauthorized"
                value={String(
                  model.unauthorized,
                )}
              />

              <View style={styles.blockers}>
                <Text style={styles.blockersTitle}>
                  Review blockers
                </Text>

                {model.blockers.length ===
                0 ? (
                  <Text style={styles.blockerText}>
                    None. Evidence is eligible for human review.
                  </Text>
                ) : (
                  model.blockers.map(
                    (blocker) => (
                      <Text
                        key={blocker}
                        style={
                          styles.blockerText
                        }
                      >
                        • {blocker}
                      </Text>
                    ),
                  )
                )}
              </View>

              <Text style={styles.footer}>
                No trip or financial payload is displayed here.
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
      top: 52,
      zIndex: 9999,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor:
        'rgba(15, 23, 42, 0.92)',
      borderWidth: 1,
      borderColor:
        'rgba(94, 234, 212, 0.55)',
    },
    floatingText: {
      color: '#99f6e4',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.7,
    },
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
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
    },
    metricValue: {
      color: '#f8fafc',
      fontWeight: '700',
      textAlign: 'right',
      flex: 1,
    },
    blockers: {
      marginTop: 8,
      padding: 14,
      borderRadius: 18,
      backgroundColor: '#111c31',
      gap: 6,
    },
    blockersTitle: {
      color: '#f8fafc',
      fontWeight: '800',
      marginBottom: 4,
    },
    blockerText: {
      color: '#cbd5e1',
      fontSize: 13,
      lineHeight: 19,
    },
    footer: {
      color: '#64748b',
      fontSize: 12,
      textAlign: 'center',
      marginTop: 10,
    },
  });
