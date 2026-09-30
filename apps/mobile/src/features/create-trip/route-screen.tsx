import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {
  useRouter,
  type Href,
} from 'expo-router';
import * as Haptics from 'expo-haptics';
import { XStack, YStack } from 'tamagui';
import { JzText } from '@jahiz/ui';
import {
  colors,
  radius,
  spacing,
  touchTarget,
} from '@jahiz/design-tokens';
import {
  createTripRouteRequestSchema,
  type AirportDirectoryItem,
} from '@jahiz/api-contracts';
import { JzFlowAppBar } from '@/components/jz-flow-app-bar';
import { JzFlowFooter } from '@/components/jz-flow-footer';
import { JzGlassPanel } from '@/components/jz-glass-panel';
import { JzIcon } from '@/components/jz-icon';
import { JzShellSurface } from '@/components/jz-shell-surface';
import { Screen } from '@/components/screen';
import { airportToLocationSelection } from '@/entities/airport/airport-directory';
import { useJahizLocale } from '@/providers/locale-provider';
import { useJahizTheme } from '@/providers/theme-provider';
import { useTripWorkspaceStore } from '@/features/trip-workspace';
import { AirportSearchModal } from './airport-search-modal';
import { LocationCard } from './location-card';
import type { RouteSelectionTarget } from './route-types';
import { findAirportForLocation } from './route-workspace-adapter';

export function RouteScreen() {
  const router = useRouter();
  const { isRtl, t } = useJahizLocale();
  const { palette } = useJahizTheme();
  const savedRoute = useTripWorkspaceStore(
    (state) => state.workspace.route,
  );
  const hasHydrated = useTripWorkspaceStore(
    (state) => state.hasHydrated,
  );
  const setWorkspaceRoute = useTripWorkspaceStore(
    (state) => state.setRoute,
  );

  const [searchTarget, setSearchTarget] =
    useState<RouteSelectionTarget | null>(null);
  const [originAirport, setOriginAirport] =
    useState<AirportDirectoryItem | null>(null);
  const [destinationAirport, setDestinationAirport] =
    useState<AirportDirectoryItem | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!hasHydrated || isDirty) {
      return;
    }

    setOriginAirport(
      findAirportForLocation(savedRoute?.origin),
    );
    setDestinationAirport(
      findAirportForLocation(savedRoute?.destination),
    );
  }, [hasHydrated, isDirty, savedRoute]);

  const origin = useMemo(
    () =>
      originAirport
        ? airportToLocationSelection(originAirport)
        : null,
    [originAirport],
  );

  const destination = useMemo(
    () =>
      destinationAirport
        ? airportToLocationSelection(
            destinationAirport,
          )
        : null,
    [destinationAirport],
  );

  const validation = useMemo(() => {
    if (!origin || !destination) {
      return null;
    }

    return createTripRouteRequestSchema.safeParse({
      origin,
      destination,
    });
  }, [destination, origin]);

  const sameAirport = Boolean(
    originAirport &&
      destinationAirport &&
      originAirport.airportCode ===
        destinationAirport.airportCode,
  );
  const canContinue =
    hasHydrated &&
    validation?.success === true;
  const direction = isRtl ? 'row-reverse' : 'row';
  const textDirection = isRtl ? 'rtl' : 'ltr';
  const align = isRtl ? 'flex-end' : 'flex-start';

  function openSearch(
    target: RouteSelectionTarget,
  ) {
    void Haptics.selectionAsync();
    setSearchTarget(target);
  }

  function handleAirportSelect(
    airport: AirportDirectoryItem,
  ) {
    if (!searchTarget) {
      return;
    }

    if (searchTarget === 'origin') {
      setOriginAirport(airport);
    } else {
      setDestinationAirport(airport);
    }

    setIsDirty(true);
    void Haptics.selectionAsync();
    setSearchTarget(null);
  }

  function handleSwap() {
    if (!originAirport || !destinationAirport) {
      return;
    }

    void Haptics.selectionAsync();
    setOriginAirport(destinationAirport);
    setDestinationAirport(originAirport);
    setIsDirty(true);
  }

  function saveValidRoute(): boolean {
    if (
      !hasHydrated ||
      !validation?.success
    ) {
      return false;
    }

    setWorkspaceRoute(validation.data);
    setIsDirty(false);
    return true;
  }

  function handleContinue() {
    if (!saveValidRoute()) {
      return;
    }

    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    );
    router.replace('/trip/create/dates' as Href);
  }

  function handleSaveAndExit() {
    if (canContinue) {
      saveValidRoute();
      void Haptics.selectionAsync();
    }

    router.replace('/plan');
  }

  return (
    <>
      <Screen
        topColor={palette.background}
        contentColor={palette.background}
        fixedHeader={
          <JzFlowAppBar
            title={t('createTrip')}
            eyebrow={t('routeStep')}
            isRtl={isRtl}
            backLabel={t('back')}
            onBackPress={() => router.back()}
          />
        }
        fixedFooter={
          <JzFlowFooter
            primaryLabel={t('continue')}
            secondaryLabel={t('saveAndExit')}
            primaryDisabled={!canContinue}
            isRtl={isRtl}
            onPrimaryPress={handleContinue}
            onSecondaryPress={handleSaveAndExit}
          />
        }
      >
        <JzShellSurface
          isRtl={isRtl}
          style={styles.hero}
        >
          <JzText
            variant="heading1"
            textDirection={textDirection}
            style={{
              color: palette.heroText,
            }}
          >
            {t('whereGoing')}
          </JzText>

          <JzText
            textDirection={textDirection}
            style={{
              color: palette.heroSecondary,
            }}
          >
            {t('chooseRouteLong')}
          </JzText>
        </JzShellSurface>

        <YStack
          marginTop={-24}
          paddingHorizontal={spacing[4]}
          paddingBottom={spacing[6]}
          gap={spacing[3]}
        >
          <LocationCard
            label={t('from')}
            emptyTitle={t('chooseCityAirport')}
            emptyHelper={t('searchOrigin')}
            airport={originAirport}
            isRtl={isRtl}
            accessibilityLabel={t('chooseOrigin')}
            onPress={() => openSearch('origin')}
          />

          <YStack
            alignItems="center"
            marginVertical={-2}
            zIndex={2}
          >
            <View
              style={[
                styles.connector,
                {
                  backgroundColor:
                    palette.borderStrong,
                },
              ]}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(
                'swapLocations',
              )}
              disabled={
                !originAirport ||
                !destinationAirport
              }
              onPress={handleSwap}
              style={({ pressed }) => ({
                opacity:
                  !originAirport ||
                  !destinationAirport
                    ? 0.42
                    : pressed
                      ? 0.68
                      : 1,
              })}
            >
              <View
                style={[
                  styles.swapButton,
                  {
                    backgroundColor:
                      palette.surface,
                    borderColor:
                      palette.borderStrong,
                  },
                ]}
              >
                <JzIcon
                  name="swap"
                  size={21}
                  color={colors.sky500}
                  strokeWidth={2.1}
                />
              </View>
            </Pressable>

            <View
              style={[
                styles.connector,
                {
                  backgroundColor:
                    palette.borderStrong,
                },
              ]}
            />
          </YStack>

          <LocationCard
            label={t('to')}
            emptyTitle={t('chooseCityAirport')}
            emptyHelper={t('searchDestination')}
            airport={destinationAirport}
            isRtl={isRtl}
            accessibilityLabel={t(
              'chooseDestination',
            )}
            onPress={() =>
              openSearch('destination')
            }
          />

          {sameAirport ? (
            <XStack
              flexDirection={direction}
              alignItems="center"
              gap={spacing[2]}
            >
              <JzIcon
                name="warning"
                size={18}
                color={colors.danger}
                strokeWidth={2.1}
              />

              <JzText
                variant="bodySmall"
                textDirection={textDirection}
                style={{
                  color: colors.danger,
                }}
              >
                {t('differentDestinationError')}
              </JzText>
            </XStack>
          ) : null}

          {originAirport &&
          destinationAirport &&
          !sameAirport ? (
            <JzGlassPanel
              tone="surface"
              style={styles.previewCard}
            >
              <XStack
                flexDirection={direction}
                justifyContent="space-between"
                alignItems="center"
                gap={spacing[3]}
              >
                <YStack
                  alignItems={align}
                  gap={spacing[1]}
                >
                  <JzText
                    variant="caption"
                    textDirection={textDirection}
                    style={{
                      color:
                        palette.textSecondary,
                    }}
                  >
                    {t('routePreview')}
                  </JzText>

                  <JzText
                    variant="heading2"
                    textDirection="ltr"
                    style={{
                      color: palette.textPrimary,
                    }}
                  >
                    {originAirport.airportCode} →{' '}
                    {destinationAirport.airportCode}
                  </JzText>

                  <JzText
                    variant="bodySmall"
                    textDirection="ltr"
                    style={{
                      color:
                        palette.textSecondary,
                    }}
                  >
                    {originAirport.currency} →{' '}
                    {destinationAirport.currency}
                  </JzText>
                </YStack>

                <View
                  style={[
                    styles.previewIcon,
                    {
                      backgroundColor:
                        palette.successSurface,
                      borderColor:
                        palette.border,
                    },
                  ]}
                >
                  <JzIcon
                    name="route"
                    size={24}
                    color={colors.mint600}
                    strokeWidth={2.1}
                  />
                </View>
              </XStack>
            </JzGlassPanel>
          ) : null}
        </YStack>
      </Screen>

      <AirportSearchModal
        visible={searchTarget !== null}
        target={searchTarget ?? 'origin'}
        selectedAirportCode={
          searchTarget === 'origin'
            ? originAirport?.airportCode
            : destinationAirport?.airportCode
        }
        onClose={() => setSearchTarget(null)}
        onSelect={handleAirportSelect}
      />
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[5],
    paddingBottom: 44,
    gap: spacing[2],
  },
  connector: {
    width: 2,
    height: 16,
  },
  swapButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: touchTarget / 2,
    borderWidth: 1,
  },
  previewCard: {
    padding: spacing[4],
    borderRadius: radius.xl,
  },
  previewIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
  },
});
