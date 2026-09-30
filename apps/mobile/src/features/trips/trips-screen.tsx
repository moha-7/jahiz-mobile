import {
  useMemo,
  useState,
} from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {
  type Href,
  useRouter,
} from 'expo-router';
import * as Haptics from 'expo-haptics';
import { XStack, YStack } from 'tamagui';
import { JzText } from '@jahiz/ui';
import {
  colors,
  radius,
  spacing,
} from '@jahiz/design-tokens';
import {
  deriveTripLifecycle,
  selectTripRouteLabel,
  selectUnarchivedTripRecords,
  type TripLifecycle,
  type TripRecord,
} from '@jahiz/api-contracts';
import { JzActionMenuSheet } from '@/components/jz-action-menu-sheet';
import { JzGlassPanel } from '@/components/jz-glass-panel';
import { JzIcon } from '@/components/jz-icon';
import { Screen } from '@/components/screen';
import { useJahizLocale } from '@/providers/locale-provider';
import { useJahizTheme } from '@/providers/theme-provider';
import {
  createInitialTripWorkspace,
} from '@/features/trip-workspace/trip-workspace-store';
import {
  useTripPortfolioStore,
} from '@/features/trip-workspace/trip-portfolio-store';
import {
  localCalendarIso,
} from '@/features/trip-workspace/jahiz-local-date';
import {
  accountJahizLocalNamespace,
} from '@/features/local-persistence/jahiz-local-namespace';
import {
  createSecureJahizTripSyncStateStore,
} from '@/features/sync/jahiz-trip-sync-state-secure-store';
import {
  resolveJahizSyncConflict,
  type JahizConflictResolutionStrategy,
} from '@/features/sync/jahiz-sync-conflict-resolution';
import {
  useJahizSyncReviewUiStore,
} from '@/features/sync/jahiz-sync-review-ui-store';
import {
  useJahizAuthRuntime,
} from '@/providers/jahiz-auth-runtime-provider';
import {
  createJahizAuthenticatedPortfolioAdoptionRuntime,
} from '@/features/auth/jahiz-portfolio-adoption-runtime';
import {
  useJahizPortfolioAdoptionUiStore,
} from '@/features/auth/jahiz-portfolio-adoption-ui-store';

type TripCardProps = {
  record: TripRecord;
  index: number;
  active: boolean;
  isRtl: boolean;
  todayIso: string;
  onPress: () => void;
  onMore: () => void;
};

function lifecycleTone(
  lifecycle: TripLifecycle,
) {
  switch (lifecycle) {
    case 'upcoming':
      return {
        accent: '#45B8F5',
        surface: 'rgba(69,184,245,0.10)',
        border: 'rgba(69,184,245,0.24)',
      };
    case 'in-progress':
      return {
        accent: colors.mint600,
        surface: 'rgba(48,214,162,0.10)',
        border: 'rgba(48,214,162,0.24)',
      };
    case 'completed':
      return {
        accent: '#A78BFA',
        surface: 'rgba(167,139,250,0.10)',
        border: 'rgba(167,139,250,0.22)',
      };
    case 'archived':
      return {
        accent: '#8B9AAF',
        surface: 'rgba(139,154,175,0.10)',
        border: 'rgba(139,154,175,0.22)',
      };
    case 'draft':
    default:
      return {
        accent: '#F5B94C',
        surface: 'rgba(245,185,76,0.10)',
        border: 'rgba(245,185,76,0.22)',
      };
  }
}

function TripCard({
  record,
  index,
  active,
  isRtl,
  todayIso,
  onPress,
  onMore,
}: TripCardProps) {
  const { t } = useJahizLocale();
  const { palette } = useJahizTheme();
  const direction =
    isRtl ? 'row-reverse' : 'row';
  const align =
    isRtl ? 'flex-end' : 'flex-start';
  const textDirection =
    isRtl ? 'rtl' : 'ltr';

  const lifecycle =
    deriveTripLifecycle(
      record,
      todayIso,
    );
  const visual =
    lifecycleTone(lifecycle);
  const route =
    selectTripRouteLabel(record);
  const title =
    record.name ??
    route ??
    t('tripNumber', {
      number: index + 1,
    });

  const dates =
    record.workspace.dates
      .departureDate
      ? record.workspace.dates
          .returnDate
        ? `${record.workspace.dates.departureDate} → ${record.workspace.dates.returnDate}`
        : record.workspace.dates
            .departureDate
      : t('tripDatesNotSet');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <JzGlassPanel
        tone={active ? 'dark' : 'surface'}
        style={[
          styles.tripCard,
          active
            ? {
                borderColor:
                  'rgba(48,214,162,0.30)',
              }
            : null,
        ]}
      >
        <XStack
          flexDirection={direction}
          alignItems="flex-start"
          gap={spacing[3]}
        >
          <View
            style={[
              styles.tripIcon,
              {
                backgroundColor:
                  visual.surface,
                borderColor:
                  visual.border,
              },
            ]}
          >
            <JzIcon
              name="route"
              size={20}
              color={visual.accent}
              strokeWidth={2.1}
            />
          </View>

          <YStack
            flex={1}
            minWidth={0}
            alignItems={align}
            gap={spacing[2]}
          >
            <XStack
              flexDirection={direction}
              alignItems="center"
              flexWrap="wrap"
              gap={spacing[2]}
            >
              <JzText
                variant="title"
                textDirection={textDirection}
                numberOfLines={1}
                style={{
                  color: active
                    ? colors.surface
                    : palette.textPrimary,
                  flexShrink: 1,
                }}
              >
                {title}
              </JzText>

              {active ? (
                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor:
                        'rgba(48,214,162,0.13)',
                      borderColor:
                        'rgba(48,214,162,0.28)',
                    },
                  ]}
                >
                  <JzText
                    variant="caption"
                    textDirection={textDirection}
                    style={{
                      color: '#78E6C1',
                      fontWeight: '800',
                    }}
                  >
                    {t('activeTrip')}
                  </JzText>
                </View>
              ) : null}
            </XStack>

            <JzText
              variant="bodySmall"
              textDirection="ltr"
              numberOfLines={1}
              style={{
                color: active
                  ? '#C5D2DE'
                  : palette.textSecondary,
              }}
            >
              {route ?? t('routeNotSet')}
            </JzText>

            <XStack
              flexDirection={direction}
              alignItems="center"
              gap={spacing[2]}
            >
              <JzIcon
                name="calendar"
                size={14}
                color={active
                  ? '#93A7BA'
                  : palette.textMuted}
                strokeWidth={2}
              />

              <JzText
                variant="caption"
                textDirection="ltr"
                numberOfLines={1}
                style={{
                  color: active
                    ? '#93A7BA'
                    : palette.textMuted,
                }}
              >
                {dates}
              </JzText>
            </XStack>

            <View
              style={[
                styles.statusPill,
                {
                  alignSelf: align,
                  backgroundColor:
                    visual.surface,
                  borderColor:
                    visual.border,
                },
              ]}
            >
              <JzText
                variant="caption"
                textDirection={textDirection}
                style={{
                  color: visual.accent,
                  fontWeight: '800',
                }}
              >
                {t(
                  lifecycle ===
                    'in-progress'
                    ? 'tripStatusInProgress'
                    : lifecycle ===
                        'upcoming'
                      ? 'tripStatusUpcoming'
                      : lifecycle ===
                          'completed'
                        ? 'tripStatusCompleted'
                        : lifecycle ===
                            'archived'
                          ? 'tripStatusArchived'
                          : 'tripStatusDraft',
                )}
              </JzText>
            </View>
          </YStack>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(
              'moreActions',
            )}
            hitSlop={10}
            onPress={(event) => {
              event.stopPropagation();
              onMore();
            }}
            style={[
              styles.moreButton,
              {
                backgroundColor: active
                  ? 'rgba(255,255,255,0.08)'
                  : palette.surfaceMuted,
                borderColor: active
                  ? 'rgba(255,255,255,0.12)'
                  : palette.border,
              },
            ]}
          >
            <JzIcon
              name="more"
              size={18}
              color={active
                ? colors.surface
                : palette.textPrimary}
              strokeWidth={2.1}
            />
          </Pressable>
        </XStack>
      </JzGlassPanel>
    </Pressable>
  );
}

export function TripsScreen() {
  const router = useRouter();
  const {
    isRtl,
    t,
  } = useJahizLocale();
  const { palette } = useJahizTheme();

  const {
    state: authState,
    accountResolution,
    localOwnerId,
    getAuthorizationHeader,
  } = useJahizAuthRuntime();

  const portfolio =
    useTripPortfolioStore(
      (state) => state.portfolio,
    );
  const addTrip =
    useTripPortfolioStore(
      (state) => state.addTrip,
    );
  const setActiveTrip =
    useTripPortfolioStore(
      (state) => state.setActiveTrip,
    );
  const archiveTrip =
    useTripPortfolioStore(
      (state) => state.archiveTrip,
    );
  const restoreTrip =
    useTripPortfolioStore(
      (state) => state.restoreTrip,
    );

  const applyServerTrip =
    useTripPortfolioStore(
      (state) =>
        state.applyServerTrip,
    );

  const syncReviewsByOwner =
    useJahizSyncReviewUiStore(
      (state) => state.byOwner,
    );

  const [selectedTripId, setSelectedTripId] =
    useState<string | null>(null);

  const [
    selectedSyncReviewTripId,
    setSelectedSyncReviewTripId,
  ] = useState<string | null>(
    null,
  );

  const [
    adoptionSheetOpen,
    setAdoptionSheetOpen,
  ] = useState(false);

  const [
    isAdoptingAnonymousPlans,
    setIsAdoptingAnonymousPlans,
  ] = useState(false);

  const direction =
    isRtl ? 'row-reverse' : 'row';
  const align =
    isRtl ? 'flex-end' : 'flex-start';
  const textDirection =
    isRtl ? 'rtl' : 'ltr';
  const todayIso = localCalendarIso();

  const syncOwnerId =
    authState.status ===
      'authenticated' &&
    accountResolution ===
      'resolved' &&
    localOwnerId ===
      authState.identity.ownerId
      ? authState.identity.ownerId
      : null;

  const adoptionEntry =
    useJahizPortfolioAdoptionUiStore(
      (state) => {
        if (!syncOwnerId) {
          return null;
        }

        const entry =
          state.byOwner[
            syncOwnerId
          ];

        return (
          entry?.status ===
            'offer-local-adoption' ||
          entry?.status ===
            'merge-required'
        )
          ? entry
          : null;
      },
    );

  const ownerSyncReviews =
    syncOwnerId
      ? syncReviewsByOwner[
          syncOwnerId
        ]
      : undefined;

  const syncConflictEntries =
    useMemo(
      () =>
        Object.values(
          ownerSyncReviews ?? {},
        ).filter(
          (entry) =>
            entry.kind ===
              'conflict',
        ),
      [ownerSyncReviews],
    );

  const preservedReviewEntries =
    useMemo(
      () =>
        Object.values(
          ownerSyncReviews ?? {},
        ).filter(
          (entry) =>
            entry.kind ===
              'preserved-review',
        ),
      [ownerSyncReviews],
    );

  const syncStateStore =
    useMemo(
      () =>
        syncOwnerId
          ? createSecureJahizTripSyncStateStore(
              accountJahizLocalNamespace(
                syncOwnerId,
              ),
            )
          : null,
      [syncOwnerId],
    );

  const selectedSyncReview =
    selectedSyncReviewTripId
      ? ownerSyncReviews?.[
          selectedSyncReviewTripId
        ] ?? null
      : null;

  const unarchived = useMemo(
    () =>
      selectUnarchivedTripRecords(
        portfolio,
      ),
    [portfolio],
  );

  const activeRecord = useMemo(
    () =>
      unarchived.find(
        (record) =>
          record.workspace.id ===
          portfolio.activeTripId,
      ) ?? null,
    [
      portfolio.activeTripId,
      unarchived,
    ],
  );

  const otherTrips = useMemo(
    () =>
      unarchived.filter(
        (record) =>
          record.workspace.id !==
          portfolio.activeTripId,
      ),
    [
      portfolio.activeTripId,
      unarchived,
    ],
  );

  const archived = useMemo(
    () =>
      portfolio.trips.filter(
        (record) =>
          record.archivedAt !== null,
      ),
    [portfolio.trips],
  );

  const selectedRecord =
    selectedTripId
      ? portfolio.trips.find(
          (record) =>
            record.workspace.id ===
            selectedTripId,
        ) ?? null
      : null;

  const selectedIsActive =
    selectedRecord?.workspace.id ===
    portfolio.activeTripId;

  const selectedIsArchived =
    Boolean(
      selectedRecord?.archivedAt,
    );

  const resolveSyncConflict =
    async (
      tripId: string,
      strategy:
        JahizConflictResolutionStrategy,
    ) => {
      if (
        !syncOwnerId ||
        !syncStateStore
      ) {
        return;
      }

      try {
        const result =
          await resolveJahizSyncConflict({
            tripId,
            strategy,
            stateStore:
              syncStateStore,
          });

        const ui =
          useJahizSyncReviewUiStore
            .getState();

        if (
          result.status !==
            'resolved'
        ) {
          ui.clearReview(
            syncOwnerId,
            tripId,
          );
          return;
        }

        applyServerTrip(
          result.remoteTrip,
        );

        if (
          result.state
            .preservedReview
        ) {
          ui.upsertReview(
            syncOwnerId,
            {
              tripId,
              kind:
                'preserved-review',
              conflictKind:
                result.state
                  .preservedReview.kind,
            },
          );
        } else {
          ui.clearReview(
            syncOwnerId,
            tripId,
          );
        }

        void Haptics.notificationAsync(
          Haptics
            .NotificationFeedbackType
            .Success,
        );
      } catch (error) {
        if (__DEV__) {
          console.warn(
            '[Jahiz Sync Review] resolution failed safely',
            error instanceof Error
              ? error.message
              : String(error),
          );
        }
      }
    };


  const adoptAnonymousPlans =
    async () => {
      if (
        !syncOwnerId ||
        adoptionEntry?.status !==
          'offer-local-adoption' ||
        isAdoptingAnonymousPlans
      ) {
        return;
      }

      const apiUrl =
        process.env
          .EXPO_PUBLIC_JAHIZ_API_URL
          ?.trim();

      if (!apiUrl) {
        return;
      }

      setIsAdoptingAnonymousPlans(
        true,
      );

      try {
        const runtime =
          createJahizAuthenticatedPortfolioAdoptionRuntime({
            ownerId:
              syncOwnerId,
            apiUrl,
            getAuthorizationHeader,
          });

        const result =
          await runtime.adopt();

        const ui =
          useJahizPortfolioAdoptionUiStore
            .getState();

        if (
          result.status ===
            'applied'
        ) {
          ui.markClear(
            syncOwnerId,
          );
          setAdoptionSheetOpen(
            false,
          );

          void Haptics.notificationAsync(
            Haptics
              .NotificationFeedbackType
              .Success,
          );
          return;
        }

        const latest =
          await runtime.inspect();

        if (
          (
            latest.status ===
              'offer-local-adoption' ||
            latest.status ===
              'merge-required'
          ) &&
          latest.remoteTripCount !==
            null
        ) {
          ui.setEntry({
            ownerId:
              syncOwnerId,
            status:
              latest.status,
            candidateTripCount:
              latest
                .candidateTripCount,
            accountLocalTripCount:
              latest
                .accountLocalTripCount,
            remoteTripCount:
              latest
                .remoteTripCount,
          });
        } else if (
          latest.status ===
            'nothing-local-to-adopt'
        ) {
          ui.markClear(
            syncOwnerId,
          );
          setAdoptionSheetOpen(
            false,
          );
        }
        // If remote truth is unavailable, retain the current review/gate.
        // Sync stays blocked rather than racing ahead with uncertain ownership.
      } catch (error) {
        if (__DEV__) {
          console.warn(
            '[Jahiz Anonymous Adoption] failed safely',
            error instanceof Error
              ? error.message
              : String(error),
          );
        }
      } finally {
        setIsAdoptingAnonymousPlans(
          false,
        );
      }
    };

  const keepAnonymousPlansSeparate =
    () => {
      if (syncOwnerId) {
        useJahizPortfolioAdoptionUiStore
          .getState()
          .markClear(
            syncOwnerId,
          );
      }

      setAdoptionSheetOpen(
        false,
      );
    };


  const createTrip = () => {
    const currentActiveRecord =
      portfolio.activeTripId
        ? portfolio.trips.find(
            (record) =>
              record.workspace.id ===
              portfolio.activeTripId,
          )
        : null;

    const currency =
      currentActiveRecord?.workspace.currency ??
      portfolio.trips[0]?.workspace
        .currency ??
      'AED';

    addTrip({
      workspace:
        createInitialTripWorkspace(
          currency,
        ),
      makeActive: true,
    });

    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    );

    router.push(
      '/trip/create/route',
    );
  };

  const openTrip = (
    record: TripRecord,
  ) => {
    if (record.archivedAt) {
      setSelectedTripId(
        record.workspace.id,
      );
      return;
    }

    if (
      record.workspace.id !==
      portfolio.activeTripId
    ) {
      setActiveTrip(
        record.workspace.id,
      );
      void Haptics.selectionAsync();
    }

    router.replace('/' as Href);
  };

  return (
    <Screen
      contentColor={palette.background}
      topColor={palette.background}
      bottomPadding={spacing[8]}
      fixedHeader={
        <View
          style={[
            styles.header,
            {
              backgroundColor:
                palette.background,
              borderColor:
                palette.border,
            },
          ]}
        >
          <XStack
            flexDirection={direction}
            alignItems="center"
            justifyContent="space-between"
            gap={spacing[3]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('back')}
              onPress={() =>
                router.back()
              }
              style={[
                styles.headerButton,
                {
                  backgroundColor:
                    palette.surfaceMuted,
                  borderColor:
                    palette.border,
                },
              ]}
            >
              <JzIcon
                name="back"
                size={19}
                color={palette.textPrimary}
                strokeWidth={2.1}
                isRtl={isRtl}
              />
            </Pressable>

            <JzText
              flex={1}
              variant="heading2"
              textDirection={textDirection}
              numberOfLines={1}
              style={{
                color:
                  palette.textPrimary,
              }}
            >
              {t('myTrips')}
            </JzText>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(
                'createNewTrip',
              )}
              onPress={createTrip}
              style={styles.addButton}
            >
              <JzIcon
                name="add"
                size={18}
                color={colors.navy950}
                strokeWidth={2.3}
              />
              <JzText
                variant="caption"
                textDirection={textDirection}
                style={{
                  color:
                    colors.navy950,
                  fontWeight: '900',
                }}
              >
                {t('newTrip')}
              </JzText>
            </Pressable>
          </XStack>
        </View>
      }
    >
      <YStack
        paddingHorizontal={spacing[4]}
        paddingTop={spacing[5]}
        gap={spacing[5]}
      >
        <YStack
          alignItems={align}
          gap={spacing[1]}
        >
          <JzText
            variant="heading2"
            textDirection={textDirection}
            style={{
              color: palette.textPrimary,
            }}
          >
            {t('activeTripHeading')}
          </JzText>

          <JzText
            variant="bodySmall"
            textDirection={textDirection}
            style={{
              color:
                palette.textSecondary,
            }}
          >
            {t('activeTripSectionHelper')}
          </JzText>
        </YStack>

        {adoptionEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(
              'anonymousAdoptionReviewAction',
            )}
            onPress={() => {
              setAdoptionSheetOpen(
                true,
              );
              void Haptics.selectionAsync();
            }}
          >
            <JzGlassPanel
              style={styles.syncReviewBanner}
            >
              <XStack
                flexDirection={direction}
                alignItems="flex-start"
                gap={spacing[3]}
              >
                <View
                  style={[
                    styles.infoIcon,
                    {
                      backgroundColor:
                        'rgba(45,215,164,0.10)',
                      borderColor:
                        'rgba(45,215,164,0.24)',
                    },
                  ]}
                >
                  <JzIcon
                    name="info"
                    size={18}
                    color={colors.mint600}
                    strokeWidth={2.1}
                  />
                </View>

                <YStack
                  flex={1}
                  alignItems={align}
                  gap={spacing[1]}
                >
                  <JzText
                    variant="bodySmall"
                    textDirection={textDirection}
                    style={{
                      color:
                        palette.textPrimary,
                      fontWeight: '900',
                    }}
                  >
                    {t(
                      adoptionEntry.status ===
                        'merge-required'
                        ? 'anonymousAdoptionMergeTitle'
                        : 'anonymousAdoptionBannerTitle',
                    )}
                  </JzText>

                  <JzText
                    variant="caption"
                    textDirection={textDirection}
                    style={{
                      color:
                        palette.textSecondary,
                    }}
                  >
                    {adoptionEntry.status ===
                      'merge-required'
                      ? t(
                          'anonymousAdoptionMergeHelper',
                        )
                      : t(
                          'anonymousAdoptionBannerHelper',
                          {
                            count:
                              adoptionEntry
                                .candidateTripCount,
                          },
                        )}
                  </JzText>

                  <JzText
                    variant="caption"
                    textDirection={textDirection}
                    style={{
                      color:
                        colors.mint600,
                      fontWeight: '800',
                    }}
                  >
                    {t(
                      'anonymousAdoptionReviewAction',
                    )}
                  </JzText>
                </YStack>
              </XStack>
            </JzGlassPanel>
          </Pressable>
        ) : null}

        {syncConflictEntries.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(
              'syncConflictReviewAction',
            )}
            onPress={() => {
              const first =
                syncConflictEntries[0];

              if (first) {
                setSelectedSyncReviewTripId(
                  first.tripId,
                );
                void Haptics.selectionAsync();
              }
            }}
          >
            <JzGlassPanel
              style={styles.syncReviewBanner}
            >
              <XStack
                flexDirection={direction}
                alignItems="flex-start"
                gap={spacing[3]}
              >
                <View
                  style={[
                    styles.infoIcon,
                    {
                      backgroundColor:
                        palette.dangerSurface,
                      borderColor:
                        'rgba(239,68,68,0.28)',
                    },
                  ]}
                >
                  <JzIcon
                    name="warning"
                    size={18}
                    color={colors.danger}
                    strokeWidth={2.1}
                  />
                </View>

                <YStack
                  flex={1}
                  alignItems={align}
                  gap={spacing[1]}
                >
                  <JzText
                    variant="bodySmall"
                    textDirection={textDirection}
                    style={{
                      color:
                        palette.textPrimary,
                      fontWeight: '900',
                    }}
                  >
                    {t(
                      'syncConflictBannerTitle',
                    )}
                  </JzText>

                  <JzText
                    variant="caption"
                    textDirection={textDirection}
                    style={{
                      color:
                        palette.textSecondary,
                    }}
                  >
                    {t(
                      'syncConflictBannerHelper',
                    )}
                  </JzText>

                  <JzText
                    variant="caption"
                    textDirection={textDirection}
                    style={{
                      color:
                        colors.mint600,
                      fontWeight: '800',
                    }}
                  >
                    {t(
                      'syncConflictReviewAction',
                    )}
                  </JzText>
                </YStack>
              </XStack>
            </JzGlassPanel>
          </Pressable>
        ) : null}

        {preservedReviewEntries.length > 0 ? (
          <JzGlassPanel
            style={styles.syncReviewBanner}
          >
            <XStack
              flexDirection={direction}
              alignItems="flex-start"
              gap={spacing[3]}
            >
              <View
                style={[
                  styles.infoIcon,
                  {
                    backgroundColor:
                      'rgba(69,184,245,0.10)',
                    borderColor:
                      'rgba(69,184,245,0.22)',
                  },
                ]}
              >
                <JzIcon
                  name="info"
                  size={18}
                  color="#45B8F5"
                  strokeWidth={2.1}
                />
              </View>

              <YStack
                flex={1}
                alignItems={align}
                gap={spacing[1]}
              >
                <JzText
                  variant="bodySmall"
                  textDirection={textDirection}
                  style={{
                    color:
                      palette.textPrimary,
                    fontWeight: '900',
                  }}
                >
                  {t(
                    'syncSavedDraftTitle',
                  )}
                </JzText>

                <JzText
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color:
                      palette.textSecondary,
                  }}
                >
                  {t(
                    'syncSavedDraftHelper',
                  )}
                </JzText>
              </YStack>
            </XStack>
          </JzGlassPanel>
        ) : null}

        {activeRecord ? (
          <TripCard
            record={activeRecord}
            index={Math.max(
              0,
              unarchived.indexOf(
                activeRecord,
              ),
            )}
            active
            isRtl={isRtl}
            todayIso={todayIso}
            onPress={() =>
              openTrip(activeRecord)
            }
            onMore={() => {
              setSelectedTripId(
                activeRecord.workspace.id,
              );
              void Haptics.selectionAsync();
            }}
          />
        ) : null}

        {otherTrips.length > 0 ? (
          <YStack gap={spacing[3]}>
            <YStack
              alignItems={align}
              gap={spacing[1]}
            >
              <JzText
                variant="heading2"
                textDirection={textDirection}
                style={{
                  color:
                    palette.textPrimary,
                }}
              >
                {t('otherTrips')}
              </JzText>

              <JzText
                variant="bodySmall"
                textDirection={textDirection}
                style={{
                  color:
                    palette.textSecondary,
                }}
              >
                {t('otherTripsHelper')}
              </JzText>
            </YStack>

            {otherTrips.map(
              (record) => (
                <TripCard
                  key={record.workspace.id}
                  record={record}
                  index={Math.max(
                    0,
                    unarchived.indexOf(
                      record,
                    ),
                  )}
                  active={false}
                  isRtl={isRtl}
                  todayIso={todayIso}
                  onPress={() =>
                    openTrip(record)
                  }
                  onMore={() => {
                    setSelectedTripId(
                      record.workspace.id,
                    );
                    void Haptics.selectionAsync();
                  }}
                />
              ),
            )}
          </YStack>
        ) : null}

        {archived.length > 0 ? (
          <YStack gap={spacing[3]}>
            <YStack
              alignItems={align}
              gap={spacing[1]}
            >
              <JzText
                variant="heading2"
                textDirection={textDirection}
                style={{
                  color:
                    palette.textPrimary,
                }}
              >
                {t('archivedTrips')}
              </JzText>

              <JzText
                variant="bodySmall"
                textDirection={textDirection}
                style={{
                  color:
                    palette.textSecondary,
                }}
              >
                {t('archivedTripsHelper')}
              </JzText>
            </YStack>

            {archived.map(
              (record, index) => (
                <TripCard
                  key={record.workspace.id}
                  record={record}
                  index={
                    unarchived.length +
                    index
                  }
                  active={false}
                  isRtl={isRtl}
                  todayIso={todayIso}
                  onPress={() =>
                    openTrip(record)
                  }
                  onMore={() => {
                    setSelectedTripId(
                      record.workspace.id,
                    );
                    void Haptics.selectionAsync();
                  }}
                />
              ),
            )}
          </YStack>
        ) : null}

        <JzGlassPanel
          style={styles.foundationNote}
        >
          <XStack
            flexDirection={direction}
            alignItems="flex-start"
            gap={spacing[3]}
          >
            <View
              style={[
                styles.infoIcon,
                {
                  backgroundColor:
                    'rgba(69,184,245,0.10)',
                  borderColor:
                    'rgba(69,184,245,0.22)',
                },
              ]}
            >
              <JzIcon
                name="info"
                size={18}
                color="#45B8F5"
                strokeWidth={2.1}
              />
            </View>

            <JzText
              flex={1}
              variant="bodySmall"
              textDirection={textDirection}
              style={{
                color:
                  palette.textSecondary,
              }}
            >
              {t('tripIsolationHelper')}
            </JzText>
          </XStack>
        </JzGlassPanel>
      </YStack>

      <JzActionMenuSheet
        visible={Boolean(selectedRecord)}
        title={
          selectedRecord?.name ??
          (selectedRecord
            ? selectTripRouteLabel(
                selectedRecord,
              ) ??
              t('tripLabel')
            : t('tripLabel'))
        }
        helper={
          selectedIsArchived
            ? t('archivedTripActions')
            : selectedIsActive
              ? t('activeTripActions')
              : t('tripActions')
        }
        isRtl={isRtl}
        onClose={() =>
          setSelectedTripId(null)
        }
        actions={
          selectedRecord
            ? selectedIsArchived
              ? [
                  {
                    key: 'restore-trip',
                    label: t('restoreTrip'),
                    icon: 'check' as const,
                    onPress: () => {
                      restoreTrip(
                        selectedRecord.workspace
                          .id,
                      );
                      setSelectedTripId(
                        null,
                      );
                      void Haptics.notificationAsync(
                        Haptics
                          .NotificationFeedbackType
                          .Success,
                      );
                    },
                  },
                ]
              : [
                  ...(
                    selectedIsActive
                      ? []
                      : [
                          {
                            key: 'set-active-trip',
                            label:
                              t('makeActiveTrip'),
                            icon:
                              'check' as const,
                            onPress: () => {
                              setActiveTrip(
                                selectedRecord
                                  .workspace.id,
                              );
                              setSelectedTripId(
                                null,
                              );
                              void Haptics.selectionAsync();
                            },
                          },
                        ]
                  ),
                  {
                    key: 'archive-trip',
                    label:
                      unarchived.length <= 1
                        ? t(
                            'keepOneActiveTrip',
                          )
                        : t('archiveTrip'),
                    icon: 'delete' as const,
                    tone: 'danger' as const,
                    disabled:
                      unarchived.length <= 1,
                    onPress: () => {
                      if (
                        unarchived.length <= 1
                      ) {
                        return;
                      }

                      archiveTrip(
                        selectedRecord.workspace
                          .id,
                      );
                      setSelectedTripId(
                        null,
                      );
                      void Haptics.selectionAsync();
                    },
                  },
                ]
            : []
        }
      />

      <JzActionMenuSheet
        visible={
          adoptionSheetOpen &&
          Boolean(adoptionEntry)
        }
        title={t(
          adoptionEntry?.status ===
            'merge-required'
            ? 'anonymousAdoptionMergeTitle'
            : 'anonymousAdoptionTitle',
        )}
        helper={t(
          adoptionEntry?.status ===
            'merge-required'
            ? 'anonymousAdoptionMergeHelper'
            : 'anonymousAdoptionHelper',
        )}
        isRtl={isRtl}
        onClose={() =>
          setAdoptionSheetOpen(
            false,
          )
        }
        actions={
          adoptionEntry?.status ===
            'offer-local-adoption'
            ? [
                {
                  key:
                    'adopt-anonymous-plans',
                  label:
                    t(
                      'anonymousAdoptionConfirm',
                    ),
                  icon:
                    'check' as const,
                  tone:
                    'success' as const,
                  disabled:
                    isAdoptingAnonymousPlans,
                  onPress: () => {
                    void adoptAnonymousPlans();
                  },
                },
                {
                  key:
                    'keep-anonymous-separate',
                  label:
                    t(
                      'anonymousAdoptionKeepSeparate',
                    ),
                  icon:
                    'close' as const,
                  disabled:
                    isAdoptingAnonymousPlans,
                  onPress:
                    keepAnonymousPlansSeparate,
                },
              ]
            : adoptionEntry?.status ===
                'merge-required'
              ? [
                  {
                    key:
                      'keep-divergent-plans-separate',
                    label:
                      t(
                        'anonymousAdoptionMergeAction',
                      ),
                    icon:
                      'close' as const,
                    onPress:
                      keepAnonymousPlansSeparate,
                  },
                ]
              : []
        }
      />

      <JzActionMenuSheet
        visible={
          selectedSyncReview?.kind ===
            'conflict'
        }
        title={t(
          'syncConflictTitle',
        )}
        helper={t(
          'syncConflictHelper',
        )}
        isRtl={isRtl}
        onClose={() =>
          setSelectedSyncReviewTripId(
            null,
          )
        }
        actions={
          selectedSyncReview?.kind ===
            'conflict' &&
          selectedSyncReviewTripId
            ? [
                {
                  key:
                    'sync-use-server',
                  label:
                    t(
                      'syncUseServerVersion',
                    ),
                  icon:
                    'check' as const,
                  tone:
                    'success' as const,
                  onPress: () => {
                    void resolveSyncConflict(
                      selectedSyncReviewTripId,
                      'use-server',
                    );
                  },
                },
                {
                  key:
                    'sync-preserve-local',
                  label:
                    t(
                      'syncPreserveLocalDraft',
                    ),
                  icon:
                    'edit' as const,
                  onPress: () => {
                    void resolveSyncConflict(
                      selectedSyncReviewTripId,
                      'preserve-local',
                    );
                  },
                },
                {
                  key:
                    'sync-decide-later',
                  label:
                    t(
                      'syncDecideLater',
                    ),
                  icon:
                    'close' as const,
                  onPress: () =>
                    undefined,
                },
              ]
            : []
        }
      />

    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  addButton: {
    minHeight: 40,
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing[1],
    backgroundColor: colors.mint500,
  },
  tripCard: {
    padding: spacing[4],
    borderWidth: 1,
  },
  tripIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  moreButton: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  statusPill: {
    minHeight: 24,
    paddingHorizontal: spacing[2],
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  syncReviewBanner: {
    padding: spacing[3],
    borderWidth: 1,
  },
  foundationNote: {
    padding: spacing[3],
  },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
