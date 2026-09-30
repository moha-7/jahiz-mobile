import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {
  useLocalSearchParams,
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
} from '@jahiz/design-tokens';
import type {
  TripCostItem,
  TripPayment,
  TripPaymentStatus,
} from '@jahiz/api-contracts';
import { PaymentDatePicker } from '@/features/payments/payment-date-picker';
import { JzCollapsibleScreen } from '@/components/jz-collapsible-screen';
import { JzGlassPanel } from '@/components/jz-glass-panel';
import { JzFocusHighlight } from '@/components/jz-focus-highlight';
import { JzIcon } from '@/components/jz-icon';
import { useJahizLocale } from '@/providers/locale-provider';
import { useJahizTheme } from '@/providers/theme-provider';
import {
  isPaymentTrackableCost,
  selectNextPayment,
  useTripWorkspaceStore,
} from '@/features/trip-workspace';
import { formatMoney } from '@/utils/format-money';

type EditablePaymentStatus = Extract<
  TripPaymentStatus,
  'paid' | 'scheduled'
>;

type PaymentDraft = {
  amount: string;
  status: EditablePaymentStatus;
  dueDate: string | null;
  notes: string;
};

type PaymentEditorModalProps = {
  visible: boolean;
  item: TripPayment | null;
  cost: TripCostItem | null;
  payments: TripPayment[];
  currency: string;
  isRtl: boolean;
  locale: 'ar' | 'en';
  onClose: () => void;
  onDelete: (() => void) | null;
  onSave: (draft: {
    costItemId: string;
    amount: number;
    status: EditablePaymentStatus;
    dueDate: string | null;
    method: null;
    notes: string | null;
  }) => void;
};

type PaymentRowProps = {
  item: TripPayment;
  isRtl: boolean;
  locale: 'ar' | 'en';
  currency: string;
  onEdit: () => void;
  onMarkPaid: () => void;
};

type BookingCostCardProps = {
  cost: TripCostItem;
  payments: TripPayment[];
  isRtl: boolean;
  locale: 'ar' | 'en';
  currency: string;
  onAddPayment: () => void;
  onEditPayment: (payment: TripPayment) => void;
  onMarkPaymentPaid: (payment: TripPayment) => void;
};

function normalizeLocalizedDigits(
  value: string,
): string {
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';

  return [...value]
    .map((character) => {
      const arabicIndex =
        arabicDigits.indexOf(character);

      if (arabicIndex >= 0) {
        return String(arabicIndex);
      }

      const persianIndex =
        persianDigits.indexOf(character);

      if (persianIndex >= 0) {
        return String(persianIndex);
      }

      return character;
    })
    .join('');
}

function sanitizeMoneyInput(
  value: string,
): string {
  const normalized = normalizeLocalizedDigits(
    value,
  )
    .replace(/[,\u066B]/g, '.')
    .replace(/[^\d.]/g, '');

  const [whole = '', ...decimalParts] =
    normalized.split('.');
  const decimal = decimalParts
    .join('')
    .slice(0, 2);
  const safeWhole = whole.slice(0, 10);

  return decimalParts.length > 0
    ? `${safeWhole || '0'}.${decimal}`
    : safeWhole;
}

function parsePositiveAmount(
  value: string,
): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return Math.round(parsed * 100) / 100;
}

function isoDateFromTimestamp(
  value: string | null,
): string | null {
  return value ? value.slice(0, 10) : null;
}

function paymentStatusLabelKey(
  status: TripPaymentStatus,
):
  | 'paymentStatusPaid'
  | 'paymentStatusScheduled'
  | 'paymentStatusCancelled' {
  if (status === 'paid') {
    return 'paymentStatusPaid';
  }

  if (status === 'scheduled') {
    return 'paymentStatusScheduled';
  }

  return 'paymentStatusCancelled';
}

function createDraft(
  item: TripPayment | null,
): PaymentDraft {
  if (item) {
    return {
      amount: String(item.amount),
      status:
        item.status === 'paid'
          ? 'paid'
          : 'scheduled',
      dueDate: item.dueDate,
      notes: item.notes ?? '',
    };
  }

  return {
    amount: '',
    status: 'scheduled',
    dueDate: null,
    notes: '',
  };
}

function PaymentEditorModal({
  visible,
  item,
  cost,
  payments,
  currency,
  isRtl,
  locale,
  onClose,
  onDelete,
  onSave,
}: PaymentEditorModalProps) {
  const { t } = useJahizLocale();
  const { palette } = useJahizTheme();
  const [draft, setDraft] =
    useState<PaymentDraft>(() =>
      createDraft(item),
    );

  const direction = isRtl
    ? 'row-reverse'
    : 'row';
  const align = isRtl
    ? 'flex-end'
    : 'flex-start';
  const textDirection = isRtl
    ? 'rtl'
    : 'ltr';

  useEffect(() => {
    if (!visible) {
      return;
    }

    setDraft(createDraft(item));
  }, [item, visible]);

  const currentPaymentId = item?.id ?? null;

  const allocatedExcludingCurrent =
    useMemo(
      () =>
        cost
          ? payments
              .filter(
                (payment) =>
                  payment.costItemId ===
                    cost.id &&
                  payment.id !==
                    currentPaymentId &&
                  payment.status !==
                    'cancelled',
              )
              .reduce(
                (sum, payment) =>
                  sum + payment.amount,
                0,
              )
          : 0,
      [
        cost,
        currentPaymentId,
        payments,
      ],
    );

  const maxAmount = cost
    ? Math.max(
        0,
        cost.amount -
          allocatedExcludingCurrent,
      )
    : 0;

  const parsedAmount = parsePositiveAmount(
    draft.amount,
  );
  const amountIsValid = Boolean(
    parsedAmount &&
      parsedAmount <= maxAmount,
  );
  const canSave = Boolean(
    cost &&
      amountIsValid &&
      (draft.status !== 'scheduled' ||
        draft.dueDate),
  );

  function save() {
    if (
      !canSave ||
      !cost ||
      !parsedAmount
    ) {
      return;
    }

    onSave({
      costItemId: cost.id,
      amount: parsedAmount,
      status: draft.status,
      dueDate:
        draft.status === 'scheduled'
          ? draft.dueDate
          : null,
      method: null,
      notes:
        draft.notes.trim() || null,
    });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
        style={styles.modalRoot}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('close')}
          onPress={onClose}
          style={styles.modalBackdrop}
        />

        <View
          style={[
            styles.modalSheet,
            {
              backgroundColor:
                palette.background,
              borderColor:
                palette.borderStrong,
            },
          ]}
        >
          <View
            style={[
              styles.modalHandle,
              {
                backgroundColor:
                  palette.borderStrong,
              },
            ]}
          />

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={
              styles.modalContent
            }
          >
            <XStack
              flexDirection={direction}
              alignItems="center"
              justifyContent="space-between"
              gap={spacing[3]}
            >
              <YStack
                flex={1}
                minWidth={0}
                alignItems={align}
                gap={4}
              >
                <JzText
                  variant="heading2"
                  textDirection={textDirection}
                  style={{
                    color:
                      palette.textPrimary,
                  }}
                >
                  {item
                    ? t('editPayment')
                    : t('addPayment')}
                </JzText>

                <JzText
                  variant="bodySmall"
                  textDirection={textDirection}
                  style={{
                    color:
                      palette.textSecondary,
                  }}
                >
                  {t(
                    'paymentContextLockedHelper',
                  )}
                </JzText>
              </YStack>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('close')}
                onPress={onClose}
                style={[
                  styles.roundButton,
                  {
                    backgroundColor:
                      palette.surfaceMuted,
                    borderColor:
                      palette.border,
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

            {cost ? (
              <View
                style={[
                  styles.lockedCostCard,
                  {
                    flexDirection: direction,
                    backgroundColor:
                      palette.surfaceMuted,
                    borderColor:
                      palette.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.lockedCostIcon,
                    {
                      backgroundColor:
                        palette.infoSurface,
                    },
                  ]}
                >
                  <JzIcon
                    name="receipt"
                    size={19}
                    color={colors.sky500}
                    strokeWidth={2.1}
                  />
                </View>

                <YStack
                  flex={1}
                  minWidth={0}
                  alignItems={align}
                  gap={2}
                >
                  <JzText
                    variant="caption"
                    textDirection={textDirection}
                    style={{
                      color:
                        palette.textMuted,
                    }}
                  >
                    {t('selectedPaymentCost')}
                  </JzText>

                  <JzText
                    variant="title"
                    textDirection={textDirection}
                    numberOfLines={1}
                    style={{
                      color:
                        palette.textPrimary,
                    }}
                  >
                    {cost.title}
                  </JzText>
                </YStack>

                <JzText
                  variant="bodySmall"
                  textDirection="ltr"
                  style={{
                    color:
                      palette.textSecondary,
                    fontWeight: '700',
                  }}
                >
                  {formatMoney(
                    cost.amount,
                    locale,
                    currency,
                  )}
                </JzText>
              </View>
            ) : null}

            <YStack gap={spacing[2]}>
              <XStack
                flexDirection={direction}
                alignItems="center"
                justifyContent="space-between"
                gap={spacing[2]}
              >
                <JzText
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color:
                      palette.textSecondary,
                  }}
                >
                  {t('paymentAmount')}
                </JzText>

                <JzText
                  variant="caption"
                  textDirection="ltr"
                  style={{
                    color:
                      palette.textMuted,
                  }}
                >
                  {t(
                    'paymentMaximumAmount',
                    {
                      amount: formatMoney(
                        maxAmount,
                        locale,
                        currency,
                      ),
                    },
                  )}
                </JzText>
              </XStack>

              <View
                style={[
                  styles.amountShell,
                  {
                    flexDirection: direction,
                    backgroundColor:
                      palette.inputBackground,
                    borderColor:
                      palette.borderStrong,
                  },
                ]}
              >
                <TextInput
                  value={draft.amount}
                  maxLength={13}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={
                    palette.textMuted
                  }
                  onChangeText={(value) =>
                    setDraft(
                      (current) => ({
                        ...current,
                        amount:
                          sanitizeMoneyInput(
                            value,
                          ),
                      }),
                    )
                  }
                  style={[
                    styles.amountInput,
                    {
                      color:
                        palette.textPrimary,
                    },
                  ]}
                />

                <View
                  style={[
                    styles.currencyChip,
                    {
                      backgroundColor:
                        palette.surface,
                      borderColor:
                        palette.border,
                    },
                  ]}
                >
                  <JzText
                    variant="caption"
                    textDirection="ltr"
                    style={{
                      color:
                        palette.textSecondary,
                    }}
                  >
                    {currency}
                  </JzText>
                </View>
              </View>

              {!item && maxAmount > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(
                    'useFullAmount',
                  )}
                  onPress={() => {
                    setDraft(
                      (current) => ({
                        ...current,
                        amount:
                          String(maxAmount),
                      }),
                    );
                    void Haptics
                      .selectionAsync()
                      .catch(
                        () => undefined,
                      );
                  }}
                  style={[
                    styles.inlineAction,
                    {
                      alignSelf: isRtl
                        ? 'flex-end'
                        : 'flex-start',
                      backgroundColor:
                        palette.successSurface,
                      borderColor:
                        'rgba(70,214,164,0.28)',
                    },
                  ]}
                >
                  <JzIcon
                    name="check"
                    size={16}
                    color={colors.mint600}
                    strokeWidth={2.2}
                  />

                  <JzText
                    variant="bodySmall"
                    textDirection={textDirection}
                    style={{
                      color:
                        colors.mint600,
                      fontWeight: '800',
                    }}
                  >
                    {t('useFullAmount')}
                  </JzText>
                </Pressable>
              ) : null}

              {parsedAmount &&
              parsedAmount > maxAmount ? (
                <JzText
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color: colors.danger,
                  }}
                >
                  {t(
                    'paymentAmountTooHigh',
                  )}
                </JzText>
              ) : null}
            </YStack>

            {!item ? (
              <YStack gap={spacing[2]}>
                <JzText
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color:
                      palette.textSecondary,
                  }}
                >
                  {t('paymentStatus')}
                </JzText>

                <XStack
                  flexDirection={direction}
                  gap={spacing[2]}
                >
                  {(
                    [
                      'paid',
                      'scheduled',
                    ] as const
                  ).map((status) => {
                    const selected =
                      draft.status ===
                      status;

                    return (
                      <Pressable
                        key={status}
                        accessibilityRole="button"
                        accessibilityState={{
                          selected,
                        }}
                        onPress={() => {
                          setDraft(
                            (current) => ({
                              ...current,
                              status,
                              dueDate:
                                status ===
                                'paid'
                                  ? null
                                  : current.dueDate,
                            }),
                          );
                          void Haptics
                            .selectionAsync()
                            .catch(
                              () => undefined,
                            );
                        }}
                        style={[
                          styles.optionChip,
                          {
                            backgroundColor:
                              selected
                                ? status ===
                                  'paid'
                                  ? palette.successSurface
                                  : palette.infoSurface
                                : palette.surfaceMuted,
                            borderColor:
                              selected
                                ? status ===
                                  'paid'
                                  ? colors.mint500
                                  : colors.sky500
                                : palette.border,
                          },
                        ]}
                      >
                        <JzText
                          variant="bodySmall"
                          textDirection={textDirection}
                          style={{
                            color:
                              selected
                                ? status ===
                                  'paid'
                                  ? colors.mint600
                                  : colors.sky500
                                : palette.textPrimary,
                            fontWeight:
                              '800',
                          }}
                        >
                          {status === 'paid'
                            ? t(
                                'paymentStatusPaid',
                              )
                            : t(
                                'paymentStatusScheduled',
                              )}
                        </JzText>
                      </Pressable>
                    );
                  })}
                </XStack>
              </YStack>
            ) : null}

            {draft.status === 'scheduled' ? (
              <PaymentDatePicker
                selectedDate={draft.dueDate}
                locale={locale}
                isRtl={isRtl}
                onSelect={(dueDate) =>
                  setDraft(
                    (current) => ({
                      ...current,
                      dueDate,
                    }),
                  )
                }
              />
            ) : null}

            <YStack gap={spacing[2]}>
              <JzText
                variant="caption"
                textDirection={textDirection}
                style={{
                  color:
                    palette.textSecondary,
                }}
              >
                {t('paymentNotes')}
              </JzText>

              <TextInput
                value={draft.notes}
                maxLength={500}
                multiline
                placeholder={t(
                  'paymentNotesPlaceholder',
                )}
                placeholderTextColor={
                  palette.textMuted
                }
                onChangeText={(notes) =>
                  setDraft(
                    (current) => ({
                      ...current,
                      notes,
                    }),
                  )
                }
                style={[
                  styles.notesInput,
                  {
                    color:
                      palette.textPrimary,
                    backgroundColor:
                      palette.inputBackground,
                    borderColor:
                      palette.borderStrong,
                    textAlign: isRtl
                      ? 'right'
                      : 'left',
                    writingDirection:
                      textDirection,
                  },
                ]}
              />
            </YStack>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                disabled: !canSave,
              }}
              disabled={!canSave}
              onPress={save}
              style={({ pressed }) => [
                styles.modalPrimary,
                {
                  opacity: !canSave
                    ? 0.42
                    : pressed
                      ? 0.84
                      : 1,
                  backgroundColor:
                    colors.mint500,
                },
              ]}
            >
              <JzText
                variant="title"
                textDirection={textDirection}
                style={{
                  color:
                    colors.navy950,
                }}
              >
                {item
                  ? t(
                      'savePaymentChanges',
                    )
                  : t('addPayment')}
              </JzText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('cancel')}
              onPress={onClose}
              style={[
                styles.modalSecondary,
                {
                  backgroundColor:
                    palette.surfaceMuted,
                  borderColor:
                    palette.borderStrong,
                },
              ]}
            >
              <JzText
                variant="title"
                textDirection={textDirection}
                style={{
                  color:
                    palette.textPrimary,
                }}
              >
                {t('cancel')}
              </JzText>
            </Pressable>

            {item && onDelete ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(
                  'removePayment',
                )}
                onPress={onDelete}
                style={[
                  styles.modalDanger,
                  {
                    backgroundColor:
                      palette.dangerSurface,
                    borderColor:
                      'rgba(239,68,68,0.28)',
                  },
                ]}
              >
                <JzIcon
                  name="delete"
                  size={18}
                  color={colors.danger}
                  strokeWidth={2.1}
                />

                <JzText
                  variant="bodySmall"
                  textDirection={textDirection}
                  style={{
                    color: colors.danger,
                    fontWeight: '800',
                  }}
                >
                  {t('removePayment')}
                </JzText>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PaymentRow({
  item,
  isRtl,
  locale,
  currency,
  onEdit,
  onMarkPaid,
}: PaymentRowProps) {
  const { t } = useJahizLocale();
  const { palette } = useJahizTheme();
  const direction = isRtl
    ? 'row-reverse'
    : 'row';
  const textDirection = isRtl
    ? 'rtl'
    : 'ltr';

  const statusColor =
    item.status === 'paid'
      ? colors.mint600
      : item.status === 'scheduled'
        ? colors.sky500
        : palette.textMuted;
  const statusSurface =
    item.status === 'paid'
      ? palette.successSurface
      : item.status === 'scheduled'
        ? palette.infoSurface
        : palette.surfaceMuted;
  const dateValue =
    item.status === 'paid'
      ? isoDateFromTimestamp(
          item.paidAt,
        )
      : item.dueDate;

  return (
    <View
      style={[
        styles.paymentRow,
        {
          backgroundColor:
            palette.surfaceMuted,
        },
      ]}
    >
      <XStack
        flexDirection={direction}
        alignItems="center"
        gap={spacing[3]}
      >
        <View
          style={[
            styles.paymentIcon,
            {
              backgroundColor:
                statusSurface,
            },
          ]}
        >
          <JzIcon
            name={
              item.status === 'paid'
                ? 'check'
                : item.status ===
                    'scheduled'
                  ? 'calendar'
                  : 'close'
            }
            size={18}
            color={statusColor}
            strokeWidth={2.2}
          />
        </View>

        <YStack
          flex={1}
          minWidth={0}
          gap={3}
        >
          <XStack
            flexDirection={direction}
            alignItems="center"
            gap={spacing[2]}
          >
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor:
                    statusSurface,
                },
              ]}
            >
              <JzText
                variant="caption"
                textDirection={textDirection}
                style={{
                  color: statusColor,
                  fontWeight: '800',
                }}
              >
                {t(
                  paymentStatusLabelKey(
                    item.status,
                  ),
                )}
              </JzText>
            </View>
          </XStack>

          <JzText
            variant="title"
            textDirection="ltr"
            style={{
              color:
                palette.textPrimary,
            }}
          >
            {formatMoney(
              item.amount,
              locale,
              currency,
            )}
          </JzText>

          {dateValue ? (
            <JzText
              variant="caption"
              textDirection="ltr"
              style={{
                color:
                  palette.textMuted,
              }}
            >
              {item.status === 'paid'
                ? t(
                    'paymentPaidDateValue',
                    {
                      date: dateValue,
                    },
                  )
                : t(
                    'paymentDueDateValue',
                    {
                      date: dateValue,
                    },
                  )}
            </JzText>
          ) : null}
        </YStack>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(
            'editPayment',
          )}
          onPress={onEdit}
          style={[
            styles.rowAction,
            {
              backgroundColor:
                palette.surface,
              borderColor:
                palette.border,
            },
          ]}
        >
          <JzIcon
            name="edit"
            size={17}
            color={palette.textPrimary}
            strokeWidth={2.1}
          />
        </Pressable>
      </XStack>

      {item.status === 'scheduled' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(
            'markPaymentPaid',
          )}
          onPress={onMarkPaid}
          style={({ pressed }) => [
            styles.markPaidButton,
            {
              opacity: pressed
                ? 0.84
                : 1,
              backgroundColor:
                palette.successSurface,
              borderColor:
                'rgba(70,214,164,0.28)',
            },
          ]}
        >
          <JzIcon
            name="check"
            size={17}
            color={colors.mint600}
            strokeWidth={2.2}
          />

          <JzText
            variant="bodySmall"
            textDirection={textDirection}
            style={{
              color: colors.mint600,
              fontWeight: '800',
            }}
          >
            {t('markPaymentPaid')}
          </JzText>
        </Pressable>
      ) : null}
    </View>
  );
}

function BookingCostCard({
  cost,
  payments,
  isRtl,
  locale,
  currency,
  onAddPayment,
  onEditPayment,
  onMarkPaymentPaid,
}: BookingCostCardProps) {
  const { t } = useJahizLocale();
  const { palette } = useJahizTheme();
  const direction = isRtl
    ? 'row-reverse'
    : 'row';
  const align = isRtl
    ? 'flex-end'
    : 'flex-start';
  const textDirection = isRtl
    ? 'rtl'
    : 'ltr';

  const [expanded, setExpanded] =
    useState(() =>
      payments.some(
        (payment) =>
          payment.status === 'scheduled',
      ),
    );

  const paidTotal = payments
    .filter(
      (payment) =>
        payment.status === 'paid',
    )
    .reduce(
      (sum, payment) =>
        sum + payment.amount,
      0,
    );
  const scheduledTotal = payments
    .filter(
      (payment) =>
        payment.status ===
        'scheduled',
    )
    .reduce(
      (sum, payment) =>
        sum + payment.amount,
      0,
    );
  const remaining = Math.max(
    0,
    cost.amount - paidTotal,
  );
  const allocatableRemaining = Math.max(
    0,
    cost.amount -
      paidTotal -
      scheduledTotal,
  );
  const progress =
    cost.amount > 0
      ? Math.min(
          100,
          Math.round(
            (paidTotal / cost.amount) *
              100,
          ),
        )
      : 0;

  const bookingState =
    remaining <= 0
      ? 'paid'
      : paidTotal > 0
        ? 'partial'
        : scheduledTotal > 0
          ? 'scheduled'
          : 'open';

  const activePayments = payments.filter(
    (payment) =>
      payment.status !== 'cancelled',
  );

  const sortedPayments = [
    ...activePayments,
  ].sort((left, right) => {
    const order = {
      scheduled: 0,
      paid: 1,
      cancelled: 2,
    } as const;

    if (
      order[left.status] !==
      order[right.status]
    ) {
      return (
        order[left.status] -
        order[right.status]
      );
    }

    return String(
      left.dueDate ??
        left.paidAt ??
        left.createdAt,
    ).localeCompare(
      String(
        right.dueDate ??
          right.paidAt ??
          right.createdAt,
      ),
    );
  });

  useEffect(() => {
    if (
      payments.some(
        (payment) =>
          payment.status === 'scheduled',
      )
    ) {
      setExpanded(true);
    }
  }, [payments]);

  return (
    <JzGlassPanel
      tone="surface"
      style={[
        styles.bookingCard,
        {
          borderColor:
            palette.border,
        },
      ]}
    >
      <XStack
        flexDirection={direction}
        alignItems="center"
        gap={spacing[3]}
      >
        <View
          style={[
            styles.bookingIcon,
            {
              backgroundColor:
                remaining <= 0
                  ? palette.successSurface
                  : palette.infoSurface,
            },
          ]}
        >
          <JzIcon
            name={
              remaining <= 0
                ? 'check'
                : 'receipt'
            }
            size={20}
            color={
              remaining <= 0
                ? colors.mint600
                : colors.sky500
            }
            strokeWidth={2.1}
          />
        </View>

        <YStack
          flex={1}
          minWidth={0}
          alignItems={align}
          gap={2}
        >
          <JzText
            variant="title"
            textDirection={textDirection}
            numberOfLines={1}
            style={{
              color:
                palette.textPrimary,
            }}
          >
            {cost.title}
          </JzText>

          <JzText
            variant="caption"
            textDirection="ltr"
            style={{
              color:
                palette.textSecondary,
            }}
          >
            {formatMoney(
              paidTotal,
              locale,
              currency,
            )}{' '}
            /{' '}
            {formatMoney(
              cost.amount,
              locale,
              currency,
            )}
          </JzText>
        </YStack>

        {allocatableRemaining > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(
              'addPaymentForCost',
              {
                cost: cost.title,
              },
            )}
            onPress={onAddPayment}
            style={({ pressed }) => [
              styles.addPaymentButton,
              {
                opacity: pressed
                  ? 0.84
                  : 1,
                backgroundColor:
                  palette.successSurface,
                borderColor:
                  'rgba(70,214,164,0.24)',
              },
            ]}
          >
            <JzIcon
              name="add"
              size={16}
              color={colors.mint600}
              strokeWidth={2.3}
            />

            <JzText
              variant="caption"
              textDirection={textDirection}
              style={{
                color:
                  colors.mint600,
                fontWeight: '800',
              }}
            >
              {t('addPayment')}
            </JzText>
          </Pressable>
        ) : (
          <View
            style={[
              styles.completePill,
              {
                backgroundColor:
                  bookingState === 'paid'
                    ? palette.successSurface
                    : bookingState === 'scheduled'
                      ? palette.infoSurface
                      : palette.warningSurface,
              },
            ]}
          >
            <JzText
              variant="caption"
              textDirection={textDirection}
              style={{
                color:
                  bookingState === 'paid'
                    ? colors.mint600
                    : bookingState === 'scheduled'
                      ? colors.sky500
                      : '#F5B94C',
                fontWeight: '800',
              }}
            >
              {t(
                bookingState === 'paid'
                  ? 'paymentStatusPaid'
                  : bookingState === 'scheduled'
                    ? 'paymentStatusScheduled'
                    : 'paymentStatusPartiallyPaid',
              )}
            </JzText>
          </View>
        )}
      </XStack>

      <View
        style={[
          styles.progressTrack,
          {
            backgroundColor:
              palette.surfaceStrong,
          },
        ]}
      >
        <View
          style={[
            styles.progressFill,
            {
              width: `${progress}%`,
              backgroundColor:
                colors.mint500,
            },
          ]}
        />
      </View>

      <XStack
        flexDirection={direction}
        alignItems="center"
        gap={spacing[2]}
      >
        <View
          style={[
            styles.bookingSummaryMetric,
            {
              backgroundColor:
                palette.surfaceMuted,
            },
          ]}
        >
          <JzText
            variant="caption"
            textDirection={textDirection}
            style={{
              color:
                palette.textMuted,
            }}
          >
            {t('paymentRemaining')}
          </JzText>

          <JzText
            variant="bodySmall"
            textDirection="ltr"
            style={{
              color:
                palette.textPrimary,
              fontWeight: '800',
            }}
          >
            {formatMoney(
              remaining,
              locale,
              currency,
            )}
          </JzText>
        </View>

        <View
          style={[
            styles.bookingSummaryMetric,
            {
              backgroundColor:
                scheduledTotal > 0
                  ? palette.infoSurface
                  : palette.surfaceMuted,
            },
          ]}
        >
          <JzText
            variant="caption"
            textDirection={textDirection}
            style={{
              color:
                scheduledTotal > 0
                  ? colors.sky500
                  : palette.textMuted,
            }}
          >
            {t(
              'paymentScheduledTotal',
            )}
          </JzText>

          <JzText
            variant="bodySmall"
            textDirection="ltr"
            style={{
              color:
                palette.textPrimary,
              fontWeight: '800',
            }}
          >
            {formatMoney(
              scheduledTotal,
              locale,
              currency,
            )}
          </JzText>
        </View>

        {activePayments.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              expanded,
            }}
            accessibilityLabel={t(
              expanded
                ? 'hidePaymentDetails'
                : 'viewPaymentDetails',
            )}
            onPress={() => {
              setExpanded(
                (current) => !current,
              );
              void Haptics.selectionAsync();
            }}
            style={({ pressed }) => [
              styles.detailsToggle,
              {
                opacity: pressed
                  ? 0.76
                  : 1,
                backgroundColor:
                  palette.surfaceMuted,
                borderColor:
                  palette.border,
              },
            ]}
          >
            <JzText
              variant="caption"
              textDirection={textDirection}
              numberOfLines={1}
              style={{
                color:
                  palette.textSecondary,
                fontWeight: '700',
              }}
            >
              {t(
                expanded
                  ? 'hidePaymentDetails'
                  : 'viewPaymentDetails',
              )}
            </JzText>
          </Pressable>
        ) : null}
      </XStack>

      {expanded &&
      sortedPayments.length > 0 ? (
        <YStack gap={spacing[2]}>
          <View
            style={[
              styles.separator,
              {
                backgroundColor:
                  palette.border,
              },
            ]}
          />

          {sortedPayments.map(
            (payment) => (
              <PaymentRow
                key={payment.id}
                item={payment}
                isRtl={isRtl}
                locale={locale}
                currency={currency}
                onEdit={() =>
                  onEditPayment(
                    payment,
                  )
                }
                onMarkPaid={() =>
                  onMarkPaymentPaid(
                    payment,
                  )
                }
              />
            ),
          )}
        </YStack>
      ) : null}
    </JzGlassPanel>
  );
}

export function PaymentsScreen() {
  const router = useRouter();
  const {
    isRtl,
    locale,
    t,
  } = useJahizLocale();
  const { palette } = useJahizTheme();
  const params = useLocalSearchParams<{
    focus?: string;
    id?: string;
    setup?: string;
  }>();

  const workspace = useTripWorkspaceStore(
    (state) => state.workspace,
  );

  const fromSetup =
    params.setup === '1' &&
    workspace.costsReviewed === true;
  const recordPayment =
    useTripWorkspaceStore(
      (state) => state.recordPayment,
    );
  const updatePayment =
    useTripWorkspaceStore(
      (state) => state.updatePayment,
    );
  const removePayment =
    useTripWorkspaceStore(
      (state) => state.removePayment,
    );

  const [editorVisible, setEditorVisible] =
    useState(false);
  const [
    editingPayment,
    setEditingPayment,
  ] = useState<TripPayment | null>(
    null,
  );
  const [
    editorCost,
    setEditorCost,
  ] = useState<TripCostItem | null>(
    null,
  );

  const direction = isRtl
    ? 'row-reverse'
    : 'row';
  const align = isRtl
    ? 'flex-end'
    : 'flex-start';
  const textDirection = isRtl
    ? 'rtl'
    : 'ltr';

  const bookingCosts = useMemo(
    () =>
      workspace.costItems.filter(
        isPaymentTrackableCost,
      ),
    [workspace.costItems],
  );

  const bookingCostIds = useMemo(
    () =>
      new Set(
        bookingCosts.map(
          (cost) => cost.id,
        ),
      ),
    [bookingCosts],
  );

  const spendingCosts = useMemo(
    () =>
      workspace.costItems.filter(
        (cost) =>
          !bookingCostIds.has(cost.id),
      ),
    [
      bookingCostIds,
      workspace.costItems,
    ],
  );

  const bookingPayments = useMemo(
    () =>
      workspace.payments.filter(
        (payment) =>
          bookingCostIds.has(
            payment.costItemId,
          ),
      ),
    [
      bookingCostIds,
      workspace.payments,
    ],
  );

  const bookingTotal = useMemo(
    () =>
      bookingCosts.reduce(
        (sum, cost) =>
          sum + cost.amount,
        0,
      ),
    [bookingCosts],
  );

  const paidTotal = useMemo(
    () =>
      bookingPayments
        .filter(
          (payment) =>
            payment.status === 'paid',
        )
        .reduce(
          (sum, payment) =>
            sum + payment.amount,
          0,
        ),
    [bookingPayments],
  );

  const scheduledTotal = useMemo(
    () =>
      bookingPayments
        .filter(
          (payment) =>
            payment.status ===
            'scheduled',
        )
        .reduce(
          (sum, payment) =>
            sum + payment.amount,
          0,
        ),
    [bookingPayments],
  );

  const remainingTotal = Math.max(
    0,
    bookingTotal - paidTotal,
  );

  const spendingBudgetTotal = useMemo(
    () =>
      spendingCosts.reduce(
        (sum, cost) =>
          sum + cost.amount,
        0,
      ),
    [spendingCosts],
  );

  const nextPayment = useMemo(
    () => selectNextPayment(workspace),
    [workspace],
  );
  const nextPaymentCost = useMemo(
    () =>
      nextPayment
        ? workspace.costItems.find(
            (cost) =>
              cost.id ===
              nextPayment.costItemId,
          ) ?? null
        : null,
    [
      nextPayment,
      workspace.costItems,
    ],
  );

  function closeEditor() {
    setEditorVisible(false);
    setEditingPayment(null);
    setEditorCost(null);
  }

  function openCreate(
    cost: TripCostItem,
  ) {
    setEditingPayment(null);
    setEditorCost(cost);
    setEditorVisible(true);

    void Haptics
      .selectionAsync()
      .catch(() => undefined);
  }

  function openEdit(
    payment: TripPayment,
  ) {
    const cost =
      workspace.costItems.find(
        (item) =>
          item.id ===
          payment.costItemId,
      ) ?? null;

    setEditingPayment(payment);
    setEditorCost(cost);
    setEditorVisible(true);

    void Haptics
      .selectionAsync()
      .catch(() => undefined);
  }

  function savePayment(
    draft: {
      costItemId: string;
      amount: number;
      status: EditablePaymentStatus;
      dueDate: string | null;
      method: null;
      notes: string | null;
    },
  ) {
    if (editingPayment) {
      updatePayment(
        editingPayment.id,
        {
          amount: draft.amount,
          status: draft.status,
          dueDate: draft.dueDate,
          method: null,
          notes: draft.notes,
        },
      );
    } else {
      recordPayment(draft);
    }

    closeEditor();

    void Haptics
      .notificationAsync(
        Haptics
          .NotificationFeedbackType
          .Success,
      )
      .catch(() => undefined);
  }

  function markPaymentPaid(
    payment: TripPayment,
  ) {
    updatePayment(payment.id, {
      status: 'paid',
    });

    void Haptics
      .notificationAsync(
        Haptics
          .NotificationFeedbackType
          .Success,
      )
      .catch(() => undefined);
  }

  function deletePayment(
    payment: TripPayment,
  ) {
    removePayment(payment.id);
    closeEditor();

    void Haptics
      .notificationAsync(
        Haptics
          .NotificationFeedbackType
          .Warning,
      )
      .catch(() => undefined);
  }

  const hero = (
    <YStack
      paddingTop={spacing[4]}
      paddingBottom={spacing[3]}
      alignItems={align}
      gap={spacing[2]}
    >
      <XStack
        flexDirection={direction}
        alignItems="center"
        gap={spacing[2]}
      >
        <View
          style={[
            styles.heroIcon,
            {
              backgroundColor:
                palette.successSurface,
              borderColor:
                palette.border,
            },
          ]}
        >
          <JzIcon
            name="payments"
            size={23}
            color={colors.mint600}
            strokeWidth={2.1}
          />
        </View>

        <JzText
          variant="heading1"
          textDirection={textDirection}
          style={{
            color: palette.heroText,
          }}
        >
          {t('payments')}
        </JzText>
      </XStack>

      <JzText
        textDirection={textDirection}
        style={{
          color:
            palette.heroSecondary,
        }}
      >
        {t('paymentsScreenHelperV2')}
      </JzText>
    </YStack>
  );

  return (
    <>
      <JzCollapsibleScreen
        isRtl={isRtl}
        brandLabel={t('brandName')}
        tagline={t('appTagline')}
        notificationLabel={t(
          'notifications',
        )}
        profileLabel={t('profile')}
        hero={hero}
        heroHeight={158}
        bodyOverlap={8}
        contentColor={
          palette.background
        }
        bodyStyle={[
          styles.body,
          {
            backgroundColor:
              palette.background,
          },
        ]}
        bottomPadding={224}
        onProfilePress={() =>
          router.push(
            '/profile' as Href,
          )
        }
      >
        <JzFocusHighlight
          active={
            params.focus === 'bookings' ||
            params.focus === 'payments'
          }
          borderRadius={22}
        >
          <JzGlassPanel
          tone="surface"
          style={[
            styles.overviewCard,
            {
              borderColor:
                palette.border,
            },
          ]}
        >
          <XStack
            flexDirection={direction}
            alignItems="flex-start"
            justifyContent="space-between"
            gap={spacing[3]}
          >
            <YStack
              flex={1}
              minWidth={0}
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
                {t('paymentsOutstanding')}
              </JzText>

              <JzText
                variant="heading1"
                textDirection="ltr"
                style={{
                  color:
                    palette.textPrimary,
                }}
              >
                {formatMoney(
                  remainingTotal,
                  locale,
                  workspace.currency,
                )}
              </JzText>

              <JzText
                variant="bodySmall"
                textDirection={textDirection}
                style={{
                  color:
                    palette.textMuted,
                }}
              >
                {t(
                  'paymentsOutstandingHelper',
                )}
              </JzText>
            </YStack>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(
                'manageTripCosts',
              )}
              onPress={() =>
                router.push(
                  '/trip/create/costs' as Href,
                )
              }
              style={({ pressed }) => [
                styles.manageCostsButton,
                {
                  opacity: pressed
                    ? 0.84
                    : 1,
                  backgroundColor:
                    palette.successSurface,
                  borderColor:
                    'rgba(70,214,164,0.25)',
                },
              ]}
            >
              <JzIcon
                name="add"
                size={17}
                color={colors.mint600}
                strokeWidth={2.2}
              />

              <JzText
                variant="caption"
                textDirection={textDirection}
                style={{
                  color:
                    colors.mint600,
                  fontWeight: '800',
                }}
              >
                {t('manageTripCosts')}
              </JzText>
            </Pressable>
          </XStack>

          <View
            style={[
              styles.separator,
              {
                backgroundColor:
                  palette.border,
              },
            ]}
          />

          <XStack
            flexDirection={direction}
            gap={spacing[2]}
          >
            <View
              style={[
                styles.overviewMetric,
                {
                  backgroundColor:
                    palette.surfaceMuted,
                },
              ]}
            >
              <JzText
                variant="caption"
                textDirection={textDirection}
                style={{
                  color:
                    palette.textMuted,
                }}
              >
                {t(
                  'paymentBookingTotal',
                )}
              </JzText>

              <JzText
                variant="title"
                textDirection="ltr"
                style={{
                  color:
                    palette.textPrimary,
                }}
              >
                {formatMoney(
                  bookingTotal,
                  locale,
                  workspace.currency,
                )}
              </JzText>
            </View>

            <View
              style={[
                styles.overviewMetric,
                {
                  backgroundColor:
                    palette.successSurface,
                },
              ]}
            >
              <JzText
                variant="caption"
                textDirection={textDirection}
                style={{
                  color:
                    colors.mint600,
                }}
              >
                {t('paid')}
              </JzText>

              <JzText
                variant="title"
                textDirection="ltr"
                style={{
                  color:
                    palette.textPrimary,
                }}
              >
                {formatMoney(
                  paidTotal,
                  locale,
                  workspace.currency,
                )}
              </JzText>
            </View>

            <View
              style={[
                styles.overviewMetric,
                {
                  backgroundColor:
                    palette.infoSurface,
                },
              ]}
            >
              <JzText
                variant="caption"
                textDirection={textDirection}
                style={{
                  color:
                    colors.sky500,
                }}
              >
                {t(
                  'paymentScheduledTotal',
                )}
              </JzText>

              <JzText
                variant="title"
                textDirection="ltr"
                style={{
                  color:
                    palette.textPrimary,
                }}
              >
                {formatMoney(
                  scheduledTotal,
                  locale,
                  workspace.currency,
                )}
              </JzText>
            </View>
          </XStack>

          <View
            style={[
              styles.separator,
              {
                backgroundColor:
                  palette.border,
              },
            ]}
          />

          <YStack
            gap={spacing[2]}
            style={[
              styles.balanceBreakdown,
              {
                backgroundColor:
                  palette.surfaceMuted,
              },
            ]}
          >
            <JzText
              variant="caption"
              textDirection={textDirection}
              style={{
                color: colors.sky500,
                fontWeight: '800',
              }}
            >
              {t(
                'bookingBalanceCalculation',
              )}
            </JzText>

            <XStack
              flexDirection={direction}
              alignItems="center"
              justifyContent="space-between"
              gap={spacing[3]}
            >
              <JzText
                flex={1}
                variant="caption"
                textDirection={textDirection}
                style={{
                  color:
                    palette.textSecondary,
                }}
              >
                {t('paymentBookingTotal')}
              </JzText>

              <JzText
                variant="bodySmall"
                textDirection="ltr"
                style={{
                  color:
                    palette.textPrimary,
                  fontWeight: '700',
                }}
              >
                {formatMoney(
                  bookingTotal,
                  locale,
                  workspace.currency,
                )}
              </JzText>
            </XStack>

            <XStack
              flexDirection={direction}
              alignItems="center"
              justifyContent="space-between"
              gap={spacing[3]}
            >
              <JzText
                flex={1}
                variant="caption"
                textDirection={textDirection}
                style={{
                  color:
                    palette.textSecondary,
                }}
              >
                {t('paid')}
              </JzText>

              <JzText
                variant="bodySmall"
                textDirection="ltr"
                style={{
                  color:
                    palette.textPrimary,
                  fontWeight: '700',
                }}
              >
                {`−${formatMoney(
                  paidTotal,
                  locale,
                  workspace.currency,
                )}`}
              </JzText>
            </XStack>

            <View
              style={[
                styles.separator,
                {
                  backgroundColor:
                    palette.border,
                },
              ]}
            />

            <XStack
              flexDirection={direction}
              alignItems="center"
              justifyContent="space-between"
              gap={spacing[3]}
            >
              <JzText
                flex={1}
                variant="bodySmall"
                textDirection={textDirection}
                style={{
                  color:
                    palette.textPrimary,
                  fontWeight: '800',
                }}
              >
                {t('todayBookingsLeftLabel')}
              </JzText>

              <JzText
                variant="title"
                textDirection="ltr"
                style={{
                  color:
                    palette.textPrimary,
                  fontWeight: '800',
                }}
              >
                {formatMoney(
                  remainingTotal,
                  locale,
                  workspace.currency,
                )}
              </JzText>
            </XStack>

            <JzText
              variant="caption"
              textDirection={textDirection}
              style={{
                color:
                  palette.textMuted,
              }}
            >
              {t(
                'bookingScheduledStillOutstanding',
                {
                  amount:
                    formatMoney(
                      scheduledTotal,
                      locale,
                      workspace.currency,
                    ),
                },
              )}
            </JzText>
          </YStack>
          </JzGlassPanel>
        </JzFocusHighlight>

        {fromSetup ? (
          <JzGlassPanel
            tone="surface"
            style={styles.setupFinishPanel}
          >
            <JzText
              variant="bodySmall"
              textDirection={textDirection}
              style={{
                color: palette.textSecondary,
              }}
            >
              {t('finishSetupTodayHelper')}
            </JzText>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('finishSetupToday')}
              onPress={() => {
                void Haptics.selectionAsync().catch(
                  () => undefined,
                );
                router.setParams({ setup: '0' });
                router.replace('/');
              }}
              style={({ pressed }) => [
                styles.setupFinishAction,
                {
                  backgroundColor: colors.mint500,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <JzText
                variant="title"
                textDirection={textDirection}
                style={{
                  color: colors.navy950,
                  fontWeight: '800',
                }}
              >
                {t('finishSetupToday')}
              </JzText>

              <JzIcon
                name="next"
                size={19}
                color={colors.navy950}
                isRtl={isRtl}
              />
            </Pressable>
          </JzGlassPanel>
        ) : null}

        {nextPayment &&
        nextPaymentCost &&
        bookingCostIds.has(
          nextPaymentCost.id,
        ) ? (
          <JzFocusHighlight
            active={
              params.focus ===
                'next-payment' &&
              (
                !params.id ||
                params.id ===
                  nextPayment.id
              )
            }
            borderRadius={22}
          >
            <Pressable
              accessibilityRole="button"
            accessibilityLabel={t(
              'nextPayment',
            )}
            onPress={() =>
              openEdit(nextPayment)
            }
            style={({ pressed }) => ({
              opacity: pressed
                ? 0.86
                : 1,
            })}
          >
            <JzGlassPanel
              tone="sky"
              style={styles.nextPaymentCard}
            >
              <XStack
                flexDirection={direction}
                alignItems="center"
                gap={spacing[3]}
              >
                <View
                  style={[
                    styles.nextPaymentIcon,
                    {
                      backgroundColor:
                        palette.infoSurface,
                    },
                  ]}
                >
                  <JzIcon
                    name="calendar"
                    size={21}
                    color={colors.sky500}
                    strokeWidth={2.1}
                  />
                </View>

                <YStack
                  flex={1}
                  minWidth={0}
                  alignItems={align}
                  gap={3}
                >
                  <JzText
                    variant="caption"
                    textDirection={textDirection}
                    style={{
                      color:
                        colors.sky500,
                    }}
                  >
                    {t('nextPayment')}
                  </JzText>

                  <JzText
                    variant="title"
                    textDirection={textDirection}
                    numberOfLines={1}
                    style={{
                      color:
                        palette.textPrimary,
                    }}
                  >
                    {nextPaymentCost.title}
                  </JzText>

                  <JzText
                    variant="caption"
                    textDirection="ltr"
                    style={{
                      color:
                        palette.textMuted,
                    }}
                  >
                    {nextPayment.dueDate}
                  </JzText>
                </YStack>

                <YStack
                  alignItems={
                    isRtl
                      ? 'flex-start'
                      : 'flex-end'
                  }
                  gap={4}
                >
                  <JzText
                    variant="title"
                    textDirection="ltr"
                    style={{
                      color:
                        palette.textPrimary,
                    }}
                  >
                    {formatMoney(
                      nextPayment.amount,
                      locale,
                      workspace.currency,
                    )}
                  </JzText>

                  <JzIcon
                    name="next"
                    size={18}
                    color={
                      palette.textMuted
                    }
                    strokeWidth={2.1}
                    isRtl={isRtl}
                  />
                </YStack>
              </XStack>
            </JzGlassPanel>
            </Pressable>
          </JzFocusHighlight>
        ) : null}

        <XStack
          flexDirection={direction}
          alignItems="flex-end"
          justifyContent="space-between"
          gap={spacing[3]}
        >
          <YStack
            flex={1}
            minWidth={0}
            alignItems={align}
            gap={3}
          >
            <JzText
              variant="heading2"
              textDirection={textDirection}
              style={{
                color:
                  palette.textPrimary,
              }}
            >
              {t(
                'bookingsPaymentsTitle',
              )}
            </JzText>

            <JzText
              variant="bodySmall"
              textDirection={textDirection}
              style={{
                color:
                  palette.textSecondary,
              }}
            >
              {t(
                'bookingsPaymentsHelper',
              )}
            </JzText>
          </YStack>
        </XStack>

        {bookingCosts.length > 0 ? (
          <YStack gap={spacing[3]}>
            {bookingCosts.map((cost) => (
              <BookingCostCard
                key={cost.id}
                cost={cost}
                payments={workspace.payments.filter(
                  (payment) =>
                    payment.costItemId ===
                    cost.id,
                )}
                isRtl={isRtl}
                locale={locale}
                currency={
                  workspace.currency
                }
                onAddPayment={() =>
                  openCreate(cost)
                }
                onEditPayment={openEdit}
                onMarkPaymentPaid={
                  markPaymentPaid
                }
              />
            ))}
          </YStack>
        ) : (
          <JzGlassPanel
            tone="surface"
            style={[
              styles.emptyCard,
              {
                borderColor:
                  palette.border,
              },
            ]}
          >
            <View
              style={[
                styles.emptyIcon,
                {
                  backgroundColor:
                    palette.infoSurface,
                },
              ]}
            >
              <JzIcon
                name="receipt"
                size={28}
                color={colors.sky500}
                strokeWidth={2.1}
              />
            </View>

            <YStack
              alignItems="center"
              gap={spacing[2]}
            >
              <JzText
                variant="heading2"
                textDirection={textDirection}
                textAlign="center"
                style={{
                  color:
                    palette.textPrimary,
                }}
              >
                {t(
                  'noBookableCostsTitle',
                )}
              </JzText>

              <JzText
                variant="bodySmall"
                textDirection={textDirection}
                textAlign="center"
                style={{
                  color:
                    palette.textSecondary,
                }}
              >
                {t(
                  'noBookableCostsHelper',
                )}
              </JzText>
            </YStack>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(
                'manageTripCosts',
              )}
              onPress={() =>
                router.push(
                  '/trip/create/costs' as Href,
                )
              }
              style={[
                styles.emptyAction,
                {
                  backgroundColor:
                    colors.mint500,
                },
              ]}
            >
              <JzIcon
                name="add"
                size={18}
                color={colors.navy950}
                strokeWidth={2.2}
              />

              <JzText
                variant="title"
                textDirection={textDirection}
                style={{
                  color:
                    colors.navy950,
                }}
              >
                {t('manageTripCosts')}
              </JzText>
            </Pressable>
          </JzGlassPanel>
        )}

        {spendingCosts.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(
              'openTripCosts',
            )}
            onPress={() =>
              router.push(
                '/trip/create/costs' as Href,
              )
            }
            style={({ pressed }) => ({
              opacity: pressed
                ? 0.86
                : 1,
            })}
          >
            <JzGlassPanel
              tone="surface"
              style={[
                styles.spendingCard,
                {
                  borderColor:
                    palette.border,
                },
              ]}
            >
              <XStack
                flexDirection={direction}
                alignItems="center"
                gap={spacing[3]}
              >
                <View
                  style={[
                    styles.spendingIcon,
                    {
                      backgroundColor:
                        palette.successSurface,
                    },
                  ]}
                >
                  <JzIcon
                    name="money"
                    size={21}
                    color={colors.mint600}
                    strokeWidth={2.1}
                  />
                </View>

                <YStack
                  flex={1}
                  minWidth={0}
                  alignItems={align}
                  gap={3}
                >
                  <JzText
                    variant="title"
                    textDirection={textDirection}
                    style={{
                      color:
                        palette.textPrimary,
                    }}
                  >
                    {t(
                      'tripSpendingBudget',
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
                      'tripSpendingBudgetHelper',
                    )}
                  </JzText>
                </YStack>

                <YStack
                  alignItems={
                    isRtl
                      ? 'flex-start'
                      : 'flex-end'
                  }
                  gap={4}
                >
                  <JzText
                    variant="title"
                    textDirection="ltr"
                    style={{
                      color:
                        palette.textPrimary,
                    }}
                  >
                    {formatMoney(
                      spendingBudgetTotal,
                      locale,
                      workspace.currency,
                    )}
                  </JzText>

                  <JzIcon
                    name="next"
                    size={18}
                    color={
                      palette.textMuted
                    }
                    strokeWidth={2.1}
                    isRtl={isRtl}
                  />
                </YStack>
              </XStack>
            </JzGlassPanel>
          </Pressable>
        ) : null}
      </JzCollapsibleScreen>

      <PaymentEditorModal
        key={`${editorVisible}-${editingPayment?.id ?? editorCost?.id ?? 'closed'}`}
        visible={editorVisible}
        item={editingPayment}
        cost={editorCost}
        payments={
          workspace.payments
        }
        currency={
          workspace.currency
        }
        isRtl={isRtl}
        locale={locale}
        onClose={closeEditor}
        onDelete={
          editingPayment
            ? () =>
                deletePayment(
                  editingPayment,
                )
            : null
        }
        onSave={savePayment}
      />
    </>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    gap: spacing[3],
  },
  setupFinishPanel: {
    padding: spacing[3],
    gap: spacing[3],
    borderRadius: 22,
  },
  setupFinishAction: {
    minHeight: 52,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
  },
  heroIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
  },
  overviewCard: {
    padding: spacing[3],
    gap: spacing[3],
    borderRadius: 22,
  },
  manageCostsButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    borderWidth: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  overviewMetric: {
    flex: 1,
    minWidth: 0,
    gap: 3,
    padding: spacing[3],
    borderRadius: 16,
  },
  balanceBreakdown: {
    padding: spacing[3],
    borderRadius: 16,
  },
  nextPaymentCard: {
    padding: spacing[4],
    borderRadius: 22,
  },
  nextPaymentIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  bookingCard: {
    padding: spacing[3],
    gap: spacing[2],
    borderRadius: 20,
  },
  bookingIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  addPaymentButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    borderWidth: 1,
  },
  completePill: {
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
  },
  progressTrack: {
    height: 6,
    overflow: 'hidden',
    borderRadius: radius.full,
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  paymentRow: {
    padding: spacing[3],
    borderRadius: 18,
  },
  paymentIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
  },
  statusPill: {
    minHeight: 25,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[2],
    borderRadius: radius.full,
  },
  rowAction: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    borderWidth: 1,
  },
  markPaidButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    marginTop: spacing[3],
    borderRadius: 15,
    borderWidth: 1,
  },
  spendingCard: {
    padding: spacing[4],
    borderRadius: 22,
  },
  spendingIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  emptyCard: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[8],
    gap: spacing[4],
    borderRadius: 26,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
  },
  emptyAction: {
    minHeight: 48,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    borderRadius: 16,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor:
      'rgba(2,8,18,0.64)',
  },
  modalSheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHandle: {
    width: 48,
    height: 5,
    alignSelf: 'center',
    marginTop: spacing[2],
    borderRadius: radius.full,
  },
  modalContent: {
    gap: spacing[4],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
  },
  roundButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
  },
  lockedCostCard: {
    minHeight: 74,
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: 18,
    borderWidth: 1,
  },
  lockedCostIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
  },
  amountShell: {
    minHeight: 58,
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: 18,
    borderWidth: 1,
  },
  amountInput: {
    flex: 1,
    minHeight: 56,
    paddingVertical: 0,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  currencyChip: {
    minWidth: 62,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    borderWidth: 1,
  },
  inlineAction: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    borderWidth: 1,
  },
  optionChip: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
  },
  notesInput: {
    minHeight: 100,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderRadius: 18,
    borderWidth: 1,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  modalPrimary: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  modalSecondary: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
  },
  modalDanger: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    borderRadius: 16,
    borderWidth: 1,
  },

  bookingSummaryMetric: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    borderRadius: 13,
  },
  detailsToggle: {
    minWidth: 92,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: spacing[2],
    borderRadius: 13,
    borderWidth: 1,
  },
});
