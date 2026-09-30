import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
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

type JzCalendarModalProps = {
  visible: boolean;
  title: string;
  locale: 'ar' | 'en';
  isRtl: boolean;
  selectedDate: string | null;
  minimumDate?: string | null;
  todayLabel: string;
  closeLabel: string;
  previousMonthLabel: string;
  nextMonthLabel: string;
  presentation?: 'modal' | 'overlay';
  onClose: () => void;
  onSelect: (date: string) => void;
};

type CalendarCell = {
  key: string;
  isoDate: string | null;
  day: number | null;
};

function toIsoDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function fromIsoDate(value: string | null): Date | null {
  if (!value) return null;

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

  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfMonth(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1,
  );
}

function addMonths(date: Date, amount: number): Date {
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

  for (let index = 0; index < 42; index += 1) {
    const day = index - leading + 1;

    if (day < 1 || day > daysInMonth) {
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

    cells.push({
      key: toIsoDate(date),
      isoDate: toIsoDate(date),
      day,
    });
  }

  return cells;
}

export function JzCalendarModal({
  visible,
  title,
  locale,
  isRtl,
  selectedDate,
  minimumDate = null,
  todayLabel,
  closeLabel,
  previousMonthLabel,
  nextMonthLabel,
  presentation = 'modal',
  onClose,
  onSelect,
}: JzCalendarModalProps) {
  const { palette } = useJahizTheme();
  const [month, setMonth] = useState(() =>
    startOfMonth(
      fromIsoDate(selectedDate) ??
        fromIsoDate(minimumDate) ??
        new Date(),
    ),
  );
  const direction = isRtl ? 'row-reverse' : 'row';
  const textDirection = isRtl ? 'rtl' : 'ltr';
  const todayIso = toIsoDate(new Date());

  useEffect(() => {
    if (!visible) return;

    setMonth(
      startOfMonth(
        fromIsoDate(selectedDate) ??
          fromIsoDate(minimumDate) ??
          new Date(),
      ),
    );
  }, [minimumDate, selectedDate, visible]);

  const cells = useMemo(
    () => createCalendarCells(month),
    [month],
  );

  const weekdayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(
      locale === 'ar' ? 'ar-AE' : 'en-US',
      {
        weekday: 'short',
      },
    );

    const sunday = new Date(2026, 0, 4);

    return Array.from({ length: 7 }, (_, index) =>
      formatter.format(
        new Date(
          sunday.getFullYear(),
          sunday.getMonth(),
          sunday.getDate() + index,
        ),
      ),
    );
  }, [locale]);

  const monthLabel = new Intl.DateTimeFormat(
    locale === 'ar' ? 'ar-AE' : 'en-US',
    {
      month: 'long',
      year: 'numeric',
    },
  ).format(month);

  function selectToday() {
    if (minimumDate && todayIso < minimumDate) {
      onSelect(minimumDate);
      return;
    }

    onSelect(todayIso);
  }

  const content = (
    <View
      style={[
        styles.root,
        presentation === 'overlay'
          ? styles.overlayRoot
          : null,
      ]}
    >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          onPress={onClose}
          style={styles.backdrop}
        />

        <View
          style={[
            styles.card,
            {
              backgroundColor: palette.surface,
              borderColor: palette.borderStrong,
            },
          ]}
        >
          <XStack
            flexDirection={direction}
            alignItems="center"
            justifyContent="space-between"
            gap={spacing[3]}
          >
            <YStack flex={1} gap={3}>
              <JzText
                variant="heading2"
                textDirection={textDirection}
                style={{
                  color: palette.textPrimary,
                }}
              >
                {title}
              </JzText>

              <JzText
                variant="bodySmall"
                textDirection={textDirection}
                style={{
                  color: palette.textSecondary,
                }}
              >
                {monthLabel}
              </JzText>
            </YStack>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
              onPress={onClose}
              style={[
                styles.roundButton,
                {
                  backgroundColor:
                    palette.surfaceMuted,
                  borderColor: palette.border,
                },
              ]}
            >
              <JzIcon
                name="close"
                size={20}
                color={palette.textPrimary}
                strokeWidth={2.1}
              />
            </Pressable>
          </XStack>

          <XStack
            flexDirection={direction}
            justifyContent="space-between"
            alignItems="center"
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
                styles.monthButton,
                {
                  backgroundColor:
                    palette.surfaceMuted,
                  borderColor: palette.border,
                },
              ]}
            >
              <JzIcon
                name="back"
                size={18}
                color={palette.textPrimary}
                strokeWidth={2.1}
                isRtl={false}
              />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={todayLabel}
              onPress={selectToday}
              style={[
                styles.todayButton,
                {
                  backgroundColor:
                    palette.successSurface,
                  borderColor: colors.mint500,
                },
              ]}
            >
              <JzText
                variant="bodySmall"
                textDirection={textDirection}
                style={{
                  color: colors.mint600,
                  fontWeight: '700',
                }}
              >
                {todayLabel}
              </JzText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={nextMonthLabel}
              onPress={() =>
                setMonth((current) =>
                  addMonths(current, 1),
                )
              }
              style={[
                styles.monthButton,
                {
                  backgroundColor:
                    palette.surfaceMuted,
                  borderColor: palette.border,
                },
              ]}
            >
              <JzIcon
                name="next"
                size={18}
                color={palette.textPrimary}
                strokeWidth={2.1}
                isRtl={false}
              />
            </Pressable>
          </XStack>

          <View style={styles.weekRow}>
            {weekdayLabels.map((label) => (
              <View
                key={label}
                style={styles.weekCell}
              >
                <JzText
                  variant="caption"
                  textAlign="center"
                  style={{
                    color: palette.textMuted,
                  }}
                >
                  {label}
                </JzText>
              </View>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((cell) => {
              if (!cell.isoDate || !cell.day) {
                return (
                  <View
                    key={cell.key}
                    style={styles.dayCell}
                  />
                );
              }

              const disabled = Boolean(
                minimumDate &&
                  cell.isoDate < minimumDate,
              );
              const active =
                cell.isoDate === selectedDate;
              const isToday =
                cell.isoDate === todayIso;

              return (
                <Pressable
                  key={cell.key}
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled,
                    selected: active,
                  }}
                  disabled={disabled}
                  onPress={() => onSelect(cell.isoDate!)}
                  style={[
                    styles.dayCell,
                    disabled
                      ? {
                          opacity: 0.30,
                        }
                      : null,
                  ]}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      active
                        ? styles.dayCircleSelected
                        : null,
                      isToday && !active
                        ? styles.dayCircleToday
                        : null,
                    ]}
                  >
                    <JzText
                      variant="bodySmall"
                      textAlign="center"
                      textDirection="ltr"
                      style={{
                        color: active
                          ? colors.navy950
                          : palette.textPrimary,
                        fontWeight: active
                          ? '800'
                          : '600',
                        lineHeight: 20,
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
    </View>
  );

  if (presentation === 'overlay') {
    return visible ? content : null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
  },
  overlayRoot: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    elevation: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(2,8,18,0.62)',
  },
  card: {
    gap: spacing[4],
    padding: spacing[4],
    borderRadius: 28,
    borderWidth: 1,
  },
  roundButton: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthButton: {
    width: 44,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayButton: {
    minHeight: 40,
    paddingHorizontal: spacing[4],
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: {
    backgroundColor: colors.mint500,
  },
  dayCircleToday: {
    borderColor: colors.mint500,
    borderWidth: 1,
  },
});
