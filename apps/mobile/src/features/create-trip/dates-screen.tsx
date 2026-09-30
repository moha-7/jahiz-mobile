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
import { tripDatesSchema } from '@jahiz/api-contracts';
import { JzCalendarModal } from '@/components/jz-calendar-modal';
import { JzFlowAppBar } from '@/components/jz-flow-app-bar';
import { JzFlowFooter } from '@/components/jz-flow-footer';
import { JzIcon } from '@/components/jz-icon';
import { JzShellSurface } from '@/components/jz-shell-surface';
import { Screen } from '@/components/screen';
import { useJahizLocale } from '@/providers/locale-provider';
import { useJahizTheme } from '@/providers/theme-provider';
import { useTripWorkspaceStore } from '@/features/trip-workspace';
import {
  getJahizProductMetricsStore,
} from '@/features/product-metrics/jahiz-product-metrics-secure-store';

type DateFlexibility = 'fixed' | 'flexible';
type DateTarget = 'departure' | 'return';

type DateFieldProps = {
  label: string;
  value: string;
  emptyValue: string;
  helper: string;
  isRtl: boolean;
  onPress: () => void;
};

function formatDisplayDate(
  value: string,
  locale: 'ar' | 'en',
): string {
  if (!value) return '';

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    locale === 'ar' ? 'ar-AE' : 'en-US',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    },
  ).format(date);
}

function addDays(
  isoDate: string,
  amount: number,
): string {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + amount);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function todayIso(): string {
  const today = new Date();

  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
}

function isJahizProductMetricsEnabled() {
  return (
    process.env
      .EXPO_PUBLIC_JAHIZ_PRODUCT_METRICS_ENABLED ===
    '1'
  );
}

function savedDateFlexibilityMetricName(
  value: DateFlexibility,
) {
  return value === 'flexible'
    ? 'date_flexibility_flexible_saved'
    : 'date_flexibility_fixed_saved';
}

function DateField({
  label,
  value,
  emptyValue,
  helper,
  isRtl,
  onPress,
}: DateFieldProps) {
  const { palette } = useJahizTheme();
  const direction = isRtl ? 'row-reverse' : 'row';
  const textDirection = isRtl ? 'rtl' : 'ltr';

  return (
    <YStack gap={spacing[2]}>
      <JzText
        variant="caption"
        textDirection={textDirection}
        style={{
          color: palette.textSecondary,
        }}
      >
        {label}
      </JzText>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [
          styles.dateInputShell,
          {
            flexDirection: direction,
            borderColor: palette.borderStrong,
            backgroundColor:
              palette.inputBackground,
            opacity: pressed ? 0.78 : 1,
          },
        ]}
      >
        <View
          style={[
            styles.dateIcon,
            {
              backgroundColor:
                palette.successSurface,
            },
          ]}
        >
          <JzIcon
            name="calendar"
            size={20}
            color={colors.mint600}
            strokeWidth={2.1}
          />
        </View>

        <YStack flex={1} minWidth={0} gap={2}>
          <JzText
            variant="body"
            textDirection={
              value ? 'ltr' : textDirection
            }
            numberOfLines={1}
            style={{
              color: value
                ? palette.textPrimary
                : palette.textMuted,
              fontWeight: '700',
            }}
          >
            {value || emptyValue}
          </JzText>

          {value ? (
            <JzText
              variant="caption"
              textDirection="ltr"
              style={{
                color: palette.textMuted,
              }}
            >
              {helper}
            </JzText>
          ) : null}
        </YStack>

        <JzIcon
          name="next"
          size={18}
          color={palette.textMuted}
          strokeWidth={2}
          isRtl={isRtl}
        />
      </Pressable>
    </YStack>
  );
}

function dayCount(
  departureDate: string,
  returnDate: string,
): number {
  const departure = new Date(
    `${departureDate}T00:00:00.000Z`,
  );
  const returning = new Date(
    `${returnDate}T00:00:00.000Z`,
  );

  return Math.max(
    1,
    Math.round(
      (returning.getTime() - departure.getTime()) /
        86_400_000,
    ) + 1,
  );
}

export function DatesScreen() {
  const router = useRouter();
  const {
    isRtl,
    locale,
    t,
  } = useJahizLocale();
  const { palette } = useJahizTheme();
  const savedDates = useTripWorkspaceStore(
    (state) => state.workspace.dates,
  );
  const hasHydrated = useTripWorkspaceStore(
    (state) => state.hasHydrated,
  );
  const setWorkspaceDates = useTripWorkspaceStore(
    (state) => state.setDates,
  );
  const productMetricsStore = useMemo(
    () =>
      getJahizProductMetricsStore(),
    [],
  );
  const [departureDate, setDepartureDate] =
    useState('');
  const [returnDate, setReturnDate] =
    useState('');
  const [flexibility, setFlexibility] =
    useState<DateFlexibility>('fixed');
  const [dateTarget, setDateTarget] =
    useState<DateTarget | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!hasHydrated || isDirty) return;

    setDepartureDate(
      savedDates.departureDate ?? '',
    );
    setReturnDate(savedDates.returnDate ?? '');
    setFlexibility(savedDates.flexibility);
  }, [
    hasHydrated,
    isDirty,
    savedDates,
  ]);

  const parsedDates = useMemo(
    () =>
      tripDatesSchema.safeParse({
        departureDate: departureDate || null,
        returnDate: returnDate || null,
        flexibility,
      }),
    [departureDate, flexibility, returnDate],
  );

  const hasBothDates = Boolean(
    departureDate && returnDate,
  );
  const canSave =
    hasHydrated &&
    hasBothDates &&
    parsedDates.success === true;
  const direction = isRtl ? 'row-reverse' : 'row';
  const align = isRtl ? 'flex-end' : 'flex-start';
  const textDirection = isRtl ? 'rtl' : 'ltr';

  const validationMessage = useMemo(() => {
    if (!departureDate && !returnDate) return null;
    if (!hasBothDates) return t('invalidDate');
    if (parsedDates.success) return null;

    const returnIssue = parsedDates.error.issues.find(
      (issue) => issue.path[0] === 'returnDate',
    );

    return returnIssue?.message.includes('on or after')
      ? t('returnBeforeDeparture')
      : t('invalidDate');
  }, [
    departureDate,
    hasBothDates,
    parsedDates,
    returnDate,
    t,
  ]);

  const duration =
    canSave && parsedDates.success
      ? dayCount(
          parsedDates.data.departureDate ?? '',
          parsedDates.data.returnDate ?? '',
        )
      : null;

  function markDirty() {
    if (!isDirty) setIsDirty(true);
  }

  function saveDates(): boolean {
    if (
      !hasHydrated ||
      !parsedDates.success ||
      !hasBothDates
    ) {
      return false;
    }

    setWorkspaceDates(parsedDates.data);

    if (isJahizProductMetricsEnabled()) {
      void productMetricsStore.record({
        name:
          savedDateFlexibilityMetricName(
            parsedDates.data.flexibility,
          ),
        step: 'dates',
      });
    }

    setIsDirty(false);
    return true;
  }

  function handleContinue() {
    if (!saveDates()) return;

    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    );
    router.replace(
      '/trip/create/funds' as Href,
    );
  }

  function handleSaveAndExit() {
    if (canSave) {
      saveDates();
      void Haptics.selectionAsync();
    }

    router.replace('/plan');
  }

  function selectFlexibility(
    nextFlexibility: DateFlexibility,
  ) {
    markDirty();
    setFlexibility(nextFlexibility);
    void Haptics.selectionAsync();
  }

  function selectDate(value: string) {
    markDirty();

    if (dateTarget === 'departure') {
      setDepartureDate(value);

      if (!returnDate || returnDate < value) {
        setReturnDate(addDays(value, 7));
      }
    } else {
      setReturnDate(value);
    }

    setDateTarget(null);
    void Haptics.selectionAsync();
  }

  const departureDisplay = formatDisplayDate(
    departureDate,
    locale,
  );
  const returnDisplay = formatDisplayDate(
    returnDate,
    locale,
  );

  return (
    <>
      <Screen
        topColor={palette.background}
        contentColor={palette.background}
        fixedHeader={
          <JzFlowAppBar
            title={t('createTrip')}
            eyebrow={t('datesStep')}
            isRtl={isRtl}
            backLabel={t('back')}
            onBackPress={() => router.back()}
          />
        }
        fixedFooter={
          <JzFlowFooter
            primaryLabel={t('continue')}
            secondaryLabel={t('saveAndExit')}
            primaryDisabled={!canSave}
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
            {t('whenTravelling')}
          </JzText>

          <JzText
            textDirection={textDirection}
            style={{
              color: palette.heroSecondary,
            }}
          >
            {t('chooseDatesCalendar')}
          </JzText>
        </JzShellSurface>

        <YStack
          marginTop={-24}
          paddingHorizontal={spacing[4]}
          paddingBottom={spacing[6]}
          gap={spacing[4]}
        >
          <View
            style={[
              styles.formCard,
              {
                borderColor: palette.border,
                backgroundColor:
                  palette.surface,
              },
            ]}
          >
            <DateField
              label={t('departureDate')}
              value={departureDisplay}
              emptyValue={t('selectDepartureDate')}
              helper={departureDate}
              isRtl={isRtl}
              onPress={() =>
                setDateTarget('departure')
              }
            />

            <View
              style={[
                styles.fieldDivider,
                {
                  backgroundColor: palette.border,
                },
              ]}
            />

            <DateField
              label={t('returnDate')}
              value={returnDisplay}
              emptyValue={t('selectReturnDate')}
              helper={returnDate}
              isRtl={isRtl}
              onPress={() =>
                setDateTarget('return')
              }
            />
          </View>

          <JzText
            variant="caption"
            textDirection={textDirection}
            style={{
              color: palette.textMuted,
            }}
          >
            {t('returnAutofillHelper')}
          </JzText>

          <YStack gap={spacing[2]}>
            <JzText
              variant="caption"
              textDirection={textDirection}
              style={{
                color: palette.textSecondary,
              }}
            >
              {t('dateFlexibility')}
            </JzText>

            <XStack
              flexDirection={direction}
              gap={spacing[2]}
            >
              {(
                [
                  ['fixed', t('fixedDates')],
                  [
                    'flexible',
                    t('flexibleDates'),
                  ],
                ] as const
              ).map(([value, label]) => {
                const selected =
                  flexibility === value;

                return (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected,
                    }}
                    accessibilityLabel={label}
                    onPress={() =>
                      selectFlexibility(value)
                    }
                    style={({ pressed }) => [
                      styles.flexibilityChoice,
                      {
                        borderColor: selected
                          ? colors.mint500
                          : palette.border,
                        backgroundColor: selected
                          ? palette.successSurface
                          : palette.surface,
                        opacity: pressed ? 0.82 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.choiceIndicator,
                        {
                          borderColor: selected
                            ? colors.mint600
                            : palette.borderStrong,
                          backgroundColor: selected
                            ? colors.mint600
                            : palette.surface,
                        },
                      ]}
                    >
                      {selected ? (
                        <JzIcon
                          name="check"
                          size={15}
                          color={colors.surface}
                          strokeWidth={2.5}
                        />
                      ) : null}
                    </View>

                    <JzText
                      variant="bodySmall"
                      textDirection={textDirection}
                      style={{
                        color: selected
                          ? colors.mint600
                          : palette.textPrimary,
                      }}
                    >
                      {label}
                    </JzText>
                  </Pressable>
                );
              })}
            </XStack>

            <JzText
              variant="caption"
              textDirection={textDirection}
              style={{
                color: palette.textMuted,
              }}
            >
              {t('dateFlexibilityHelper')}
            </JzText>
          </YStack>
          {validationMessage ? (
            <View
              style={[
                styles.validationCard,
                {
                  flexDirection: direction,
                  borderColor:
                    'rgba(239,68,68,0.28)',
                  backgroundColor:
                    palette.dangerSurface,
                },
              ]}
            >
              <JzIcon
                name="info"
                size={18}
                color={colors.danger}
                strokeWidth={2.15}
              />

              <JzText
                flex={1}
                variant="bodySmall"
                color={colors.danger}
                textDirection={textDirection}
              >
                {validationMessage}
              </JzText>
            </View>
          ) : null}

          {duration ? (
            <View
              style={[
                styles.previewCard,
                {
                  flexDirection: direction,
                  borderColor:
                    'rgba(40,216,161,0.30)',
                  backgroundColor:
                    palette.successSurface,
                },
              ]}
            >
              <View
                style={[
                  styles.previewIcon,
                  {
                    backgroundColor:
                      palette.successSurface,
                  },
                ]}
              >
                <JzIcon
                  name="calendar"
                  size={22}
                  color={colors.mint600}
                  strokeWidth={2.1}
                />
              </View>

              <YStack
                flex={1}
                alignItems={align}
                gap={4}
              >
                <JzText
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color:
                      palette.textSecondary,
                  }}
                >
                  {t('tripDuration')}
                </JzText>

                <JzText
                  variant="title"
                  textDirection={textDirection}
                  style={{
                    color:
                      palette.textPrimary,
                  }}
                >
                  {t('tripDays', {
                    count: duration,
                  })}
                </JzText>

                <JzText
                  variant="bodySmall"
                  textDirection="ltr"
                  style={{
                    color: palette.textMuted,
                  }}
                >
                  {departureDate} → {returnDate}
                </JzText>
              </YStack>
            </View>
          ) : null}
        </YStack>
      </Screen>

      <JzCalendarModal
        visible={dateTarget !== null}
        title={
          dateTarget === 'return'
            ? t('selectReturnDate')
            : t('selectDepartureDate')
        }
        locale={locale}
        isRtl={isRtl}
        selectedDate={
          dateTarget === 'return'
            ? returnDate || null
            : departureDate || null
        }
        minimumDate={
          dateTarget === 'return'
            ? departureDate || todayIso()
            : todayIso()
        }
        todayLabel={t('todayDate')}
        closeLabel={t('close')}
        previousMonthLabel={t('previousMonth')}
        nextMonthLabel={t('nextMonth')}
        onClose={() => setDateTarget(null)}
        onSelect={selectDate}
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
  formCard: {
    gap: spacing[4],
    padding: spacing[4],
    borderRadius: 24,
    borderWidth: 1,
  },
  fieldDivider: {
    height: StyleSheet.hairlineWidth,
  },
  dateInputShell: {
    minHeight: touchTarget + 12,
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  dateIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexibilityChoice: {
    flex: 1,
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  choiceIndicator: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  validationCard: {
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  previewCard: {
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: 22,
    borderWidth: 1,
  },
  previewIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
