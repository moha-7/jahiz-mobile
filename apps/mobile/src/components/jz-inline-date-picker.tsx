import {
  useMemo,
  useState,
} from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { XStack, YStack } from 'tamagui';
import { JzText } from '@jahiz/ui';
import {
  colors,
  radius,
  spacing,
} from '@jahiz/design-tokens';
import { JzIcon } from '@/components/jz-icon';
import { useJahizTheme } from '@/providers/theme-provider';

type CalendarCell = {
  key: string;
  isoDate: string | null;
  day: number | null;
};

export type JzInlineDatePickerProps = {
  selectedDate: string | null;
  locale: 'ar' | 'en';
  isRtl: boolean;
  onSelect: (date: string) => void;
  label: string;
  customLabel: string;
  chooseLabel: string;
  todayLabel: string;
  tomorrowLabel: string;
  inDaysLabel: (days: number) => string;
  previousMonthLabel: string;
  nextMonthLabel: string;
};

function toIsoDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function fromIsoDate(
  value: string | null,
): Date | null {
  if (!value) {
    return null;
  }

  const parts = value.split('-').map(Number);

  if (
    parts.length !== 3 ||
    !parts[0] ||
    !parts[1] ||
    !parts[2]
  ) {
    return null;
  }

  const date = new Date(
    parts[0],
    parts[1] - 1,
    parts[2],
  );

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function addDays(
  date: Date,
  amount: number,
): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + amount,
  );
}

function startOfMonth(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1,
  );
}

function addMonths(
  date: Date,
  amount: number,
): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth() + amount,
    1,
  );
}

function createCalendarCells(
  month: Date,
): CalendarCell[] {
  const firstDay = new Date(
    month.getFullYear(),
    month.getMonth(),
    1,
  );
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const leading = firstDay.getDay();
  const cells: CalendarCell[] = [];

  for (
    let index = 0;
    index < 42;
    index += 1
  ) {
    const day = index - leading + 1;

    if (
      day < 1 ||
      day > daysInMonth
    ) {
      cells.push({
        key: `empty-${index}`,
        isoDate: null,
        day: null,
      });
      continue;
    }

    const date = new Date(
      month.getFullYear(),
      month.getMonth(),
      day,
    );
    const isoDate = toIsoDate(date);

    cells.push({
      key: isoDate,
      isoDate,
      day,
    });
  }

  return cells;
}

export function JzInlineDatePicker({
  selectedDate,
  locale,
  isRtl,
  onSelect,
  label,
  customLabel,
  chooseLabel,
  todayLabel,
  tomorrowLabel,
  inDaysLabel,
  previousMonthLabel,
  nextMonthLabel,
}: JzInlineDatePickerProps) {
  const { palette } = useJahizTheme();
  const [expanded, setExpanded] =
    useState(false);
  const [month, setMonth] = useState(
    () =>
      startOfMonth(
        fromIsoDate(selectedDate) ??
          new Date(),
      ),
  );
  const direction = isRtl
    ? 'row-reverse'
    : 'row';
  const textDirection = isRtl
    ? 'rtl'
    : 'ltr';

  const quickDates = useMemo(() => {
    const today = new Date();

    return [
      {
        key: 'today',
        label: todayLabel,
        value: toIsoDate(today),
      },
      {
        key: 'tomorrow',
        label: tomorrowLabel,
        value: toIsoDate(
          addDays(today, 1),
        ),
      },
      {
        key: 'three-days',
        label: inDaysLabel(3),
        value: toIsoDate(
          addDays(today, 3),
        ),
      },
      {
        key: 'seven-days',
        label: inDaysLabel(7),
        value: toIsoDate(
          addDays(today, 7),
        ),
      },
    ];
  }, [
    inDaysLabel,
    todayLabel,
    tomorrowLabel,
  ]);

  const cells = useMemo(
    () => createCalendarCells(month),
    [month],
  );

  const weekdayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(
      locale === 'ar'
        ? 'ar-AE'
        : 'en-US',
      {
        weekday: 'short',
      },
    );
    const sunday = new Date(2026, 0, 4);

    return Array.from(
      { length: 7 },
      (_, index) =>
        formatter.format(
          addDays(sunday, index),
        ),
    );
  }, [locale]);

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(
        locale === 'ar'
          ? 'ar-AE'
          : 'en-US',
        {
          month: 'long',
          year: 'numeric',
        },
      ).format(month),
    [locale, month],
  );

  function selectDate(date: string) {
    onSelect(date);
    setExpanded(false);
  }

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

      <View
        style={[
          styles.quickRow,
          {
            flexDirection: direction,
          },
        ]}
      >
        {quickDates.map((option) => {
          const selected =
            option.value === selectedDate;

          return (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              accessibilityState={{
                selected,
              }}
              onPress={() =>
                selectDate(option.value)
              }
              style={[
                styles.quickChip,
                {
                  backgroundColor: selected
                    ? palette.infoSurface
                    : palette.surface,
                  borderColor: selected
                    ? colors.sky500
                    : palette.border,
                },
              ]}
            >
              <JzText
                variant="caption"
                textDirection={textDirection}
                style={{
                  color: selected
                    ? colors.sky500
                    : palette.textPrimary,
                  fontWeight: '700',
                }}
              >
                {option.label}
              </JzText>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={customLabel}
        accessibilityState={{
          expanded,
        }}
        onPress={() => {
          if (!expanded) {
            setMonth(
              startOfMonth(
                fromIsoDate(selectedDate) ??
                  new Date(),
              ),
            );
          }

          setExpanded(
            (current) => !current,
          );
        }}
        style={[
          styles.customDateButton,
          {
            flexDirection: direction,
            backgroundColor:
              palette.inputBackground,
            borderColor: expanded
              ? colors.sky500
              : palette.borderStrong,
          },
        ]}
      >
        <View
          style={[
            styles.calendarIcon,
            {
              backgroundColor:
                palette.infoSurface,
            },
          ]}
        >
          <JzIcon
            name="calendar"
            size={19}
            color={colors.sky500}
            strokeWidth={2.1}
          />
        </View>

        <YStack flex={1} gap={2}>
          <JzText
            variant="caption"
            textDirection={textDirection}
            style={{
              color: palette.textSecondary,
            }}
          >
            {customLabel}
          </JzText>

          <JzText
            variant="bodySmall"
            textDirection={
              selectedDate
                ? 'ltr'
                : textDirection
            }
            style={{
              color: selectedDate
                ? palette.textPrimary
                : palette.textMuted,
              fontWeight: '700',
            }}
          >
            {selectedDate ??
              chooseLabel}
          </JzText>
        </YStack>

        <View
          style={{
            transform: [
              {
                rotate: expanded
                  ? '180deg'
                  : '0deg',
              },
            ],
          }}
        >
          <JzIcon
            name="expand"
            size={17}
            color={palette.textMuted}
            strokeWidth={2.1}
          />
        </View>
      </Pressable>

      {expanded ? (
        <View
          style={[
            styles.calendar,
            {
              backgroundColor:
                palette.surface,
              borderColor:
                palette.borderStrong,
            },
          ]}
        >
          <XStack
            flexDirection={direction}
            alignItems="center"
            justifyContent="space-between"
            gap={spacing[2]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={previousMonthLabel}
              onPress={() =>
                setMonth((current) =>
                  addMonths(current, -1),
                )
              }
              style={[
                styles.navButton,
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
                size={17}
                color={palette.textPrimary}
                strokeWidth={2.1}
                isRtl={false}
              />
            </Pressable>

            <JzText
              flex={1}
              variant="bodySmall"
              textDirection={textDirection}
              textAlign="center"
              style={{
                color: palette.textPrimary,
                fontWeight: '800',
              }}
            >
              {monthLabel}
            </JzText>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={nextMonthLabel}
              onPress={() =>
                setMonth((current) =>
                  addMonths(current, 1),
                )
              }
              style={[
                styles.navButton,
                {
                  backgroundColor:
                    palette.surfaceMuted,
                  borderColor:
                    palette.border,
                },
              ]}
            >
              <JzIcon
                name="next"
                size={17}
                color={palette.textPrimary}
                strokeWidth={2.1}
                isRtl={false}
              />
            </Pressable>
          </XStack>

          <View style={styles.weekRow}>
            {weekdayLabels.map(
              (label, index) => (
                <View
                  key={`${label}-${index}`}
                  style={styles.weekCell}
                >
                  <JzText
                    variant="caption"
                    textAlign="center"
                    style={{
                      color:
                        palette.textMuted,
                    }}
                  >
                    {label}
                  </JzText>
                </View>
              ),
            )}
          </View>

          <View style={styles.grid}>
            {cells.map((cell) => {
              if (
                !cell.isoDate ||
                !cell.day
              ) {
                return (
                  <View
                    key={cell.key}
                    style={styles.dayCell}
                  />
                );
              }

              const selected =
                cell.isoDate ===
                selectedDate;

              return (
                <Pressable
                  key={cell.key}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected,
                  }}
                  onPress={() =>
                    selectDate(cell.isoDate!)
                  }
                  style={styles.dayCell}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      selected
                        ? {
                            backgroundColor:
                              colors.mint500,
                          }
                        : null,
                    ]}
                  >
                    <JzText
                      variant="bodySmall"
                      textAlign="center"
                      textDirection="ltr"
                      style={{
                        color: selected
                          ? colors.navy950
                          : palette.textPrimary,
                        fontWeight: selected
                          ? '800'
                          : '600',
                      }}
                    >
                      {cell.day}
                    </JzText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </YStack>
  );
}

const styles = StyleSheet.create({
  quickRow: {
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  quickChip: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    borderWidth: 1,
  },
  customDateButton: {
    minHeight: 56,
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  calendarIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  calendar: {
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  navButton: {
    width: 38,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
});
