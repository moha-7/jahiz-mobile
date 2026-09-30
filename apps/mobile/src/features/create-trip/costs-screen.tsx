import {
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
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack, YStack } from 'tamagui';
import { JzText } from '@jahiz/ui';
import {
  colors,
  radius,
  spacing,
} from '@jahiz/design-tokens';
import type {
  TripCostCategoryId,
  TripCostItem,
} from '@jahiz/api-contracts';
import { JzFlowAppBar } from '@/components/jz-flow-app-bar';
import { JzFlowFooter } from '@/components/jz-flow-footer';
import { JzActionMenuSheet } from '@/components/jz-action-menu-sheet';
import { JzGlassPanel } from '@/components/jz-glass-panel';
import { JzIcon } from '@/components/jz-icon';
import { JzShellSurface } from '@/components/jz-shell-surface';
import { Screen } from '@/components/screen';
import { useJahizLocale } from '@/providers/locale-provider';
import { useJahizTheme } from '@/providers/theme-provider';
import {
  selectTotalCost,
  tripCostVisualFor,
  useTripWorkspaceStore,
} from '@/features/trip-workspace';
import {
  tripCostCategories,
} from './trip-cost-categories';

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

function formatAmount(
  value: number,
  locale: 'ar' | 'en',
): string {
  return new Intl.NumberFormat(
    locale === 'ar' ? 'ar-AE' : 'en-US',
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
  ).format(value);
}

type CostEditorModalProps = {
  visible: boolean;
  initialCategoryId: TripCostCategoryId | null;
  initialItem: TripCostItem | null;
  minimumAmount: number;
  usedCategoryIds: ReadonlySet<TripCostCategoryId>;
  currency: string;
  isRtl: boolean;
  onClose: () => void;
  onSave: (input: {
    title: string;
    categoryId: TripCostCategoryId;
    amount: number;
  }) => void;
};

function CostEditorModal({
  visible,
  initialCategoryId,
  initialItem,
  minimumAmount,
  usedCategoryIds,
  currency,
  isRtl,
  onClose,
  onSave,
}: CostEditorModalProps) {
  const {
    locale,
    t,
  } = useJahizLocale();
  const { palette } = useJahizTheme();
  const insets = useSafeAreaInsets();
  const resolvedInitialCategoryId =
    initialItem?.categoryId ??
    initialCategoryId;
  const initialCategory =
    tripCostCategories.find(
      (category) =>
        category.id ===
        resolvedInitialCategoryId,
    ) ?? null;
  const initialTitle =
    initialItem?.title ??
    (initialCategory
      ? t(initialCategory.defaultTitleKey)
      : '');
  const initialAmount = initialItem
    ? String(initialItem.amount)
    : '';
  const isEditing = initialItem !== null;

  const [title, setTitle] =
    useState(initialTitle);
  const [amount, setAmount] =
    useState(initialAmount);
  const [categoryId, setCategoryId] =
    useState<TripCostCategoryId | null>(
      resolvedInitialCategoryId,
    );
  const [
    categoryPickerOpen,
    setCategoryPickerOpen,
  ] = useState(
    resolvedInitialCategoryId === null,
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
  const parsedAmount =
    parsePositiveAmount(amount);
  const amountBelowPaid =
    parsedAmount !== null &&
    parsedAmount < minimumAmount;
  const canSave = Boolean(
    title.trim() &&
      categoryId &&
      parsedAmount &&
      !amountBelowPaid,
  );
  const selectedCategory =
    tripCostCategories.find(
      (category) =>
        category.id === categoryId,
    ) ?? null;

  function resetAndClose() {
    setTitle(initialTitle);
    setAmount(initialAmount);
    setCategoryId(
      resolvedInitialCategoryId,
    );
    setCategoryPickerOpen(
      resolvedInitialCategoryId === null,
    );
    onClose();
  }

  function handleCategorySelect(
    category:
      (typeof tripCostCategories)[number],
  ) {
    setCategoryId(category.id);
    setTitle(t(category.defaultTitleKey));
    setCategoryPickerOpen(false);
    void Haptics.selectionAsync();
  }

  function handleSave() {
    if (
      !categoryId ||
      !parsedAmount ||
      !title.trim()
    ) {
      return;
    }

    onSave({
      title: title.trim(),
      categoryId,
      amount: parsedAmount,
    });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={resetAndClose}
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
          onPress={resetAndClose}
          style={styles.modalBackdrop}
        />

        <View
          style={[
            styles.modalSheet,
            {
              backgroundColor: palette.surface,
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
            keyboardDismissMode={
              Platform.OS === 'ios'
                ? 'interactive'
                : 'on-drag'
            }
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
                alignItems={align}
                gap={4}
              >
                <JzText
                  variant="heading2"
                  textDirection={textDirection}
                  style={{
                    color: palette.textPrimary,
                  }}
                >
                  {t(
                    isEditing
                      ? 'editCost'
                      : 'quickAddCost',
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
                    isEditing
                      ? 'editCostHelper'
                      : 'smartQuickAddHelper',
                  )}
                </JzText>
              </YStack>

              <View
                style={[
                  styles.quickIcon,
                  {
                    backgroundColor:
                      palette.successSurface,
                  },
                ]}
              >
                <JzIcon
                  name="sparkles"
                  size={22}
                  color={colors.mint600}
                  strokeWidth={2.15}
                />
              </View>
            </XStack>

            {selectedCategory &&
            !categoryPickerOpen ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(
                  'changeCategory',
                )}
                onPress={() =>
                  setCategoryPickerOpen(true)
                }
                style={[
                  styles.selectedCategory,
                  {
                    flexDirection: direction,
                    borderColor:
                      palette.borderStrong,
                    backgroundColor:
                      palette.successSurface,
                  },
                ]}
              >
                <View
                  style={[
                    styles.selectedCategoryIcon,
                    {
                      backgroundColor:
                        palette.surface,
                    },
                  ]}
                >
                  <JzIcon
                    name={selectedCategory.icon}
                    size={19}
                    color={colors.mint600}
                    strokeWidth={2.1}
                  />
                </View>

                <YStack
                  flex={1}
                  alignItems={align}
                  gap={2}
                >
                  <JzText
                    variant="caption"
                    textDirection={textDirection}
                    style={{
                      color:
                        palette.textSecondary,
                    }}
                  >
                    {t('selectedCategory')}
                  </JzText>

                  <JzText
                    variant="title"
                    textDirection={textDirection}
                    style={{
                      color: palette.textPrimary,
                    }}
                  >
                    {t(
                      selectedCategory.labelKey,
                    )}
                  </JzText>
                </YStack>

                <JzText
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color: colors.mint600,
                    fontWeight: '700',
                  }}
                >
                  {t('changeCategory')}
                </JzText>
              </Pressable>
            ) : (
              <YStack gap={spacing[2]}>
                <JzText
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color:
                      palette.textSecondary,
                  }}
                >
                  {t('costCategory')}
                </JzText>

                <View
                  style={[
                    styles.categoryGrid,
                    {
                      flexDirection: direction,
                    },
                  ]}
                >
                  {tripCostCategories.map(
                    (category) => {
                      const selected =
                        category.id ===
                        categoryId;
                      const alreadyIncluded =
                        usedCategoryIds.has(
                          category.id,
                        ) &&
                        category.id !==
                          resolvedInitialCategoryId;

                      return (
                        <Pressable
                          key={category.id}
                          accessibilityRole="button"
                          accessibilityState={{
                            selected,
                            disabled:
                              alreadyIncluded,
                          }}
                          accessibilityLabel={t(
                            category.labelKey,
                          )}
                          disabled={
                            alreadyIncluded
                          }
                          onPress={() =>
                            handleCategorySelect(
                              category,
                            )
                          }
                          style={({
                            pressed,
                          }) => [
                            styles.categoryChoice,
                            {
                              opacity:
                                alreadyIncluded
                                  ? 0.38
                                  : pressed
                                    ? 0.82
                                    : 1,
                              borderColor: selected
                                ? colors.mint500
                                : palette.border,
                              backgroundColor:
                                selected
                                  ? palette.successSurface
                                  : palette.surfaceMuted,
                            },
                          ]}
                        >
                          <JzIcon
                            name={category.icon}
                            size={18}
                            color={
                              selected
                                ? colors.mint600
                                : palette.textSecondary
                            }
                            strokeWidth={2.1}
                          />

                          <JzText
                            variant="caption"
                            textDirection={
                              textDirection
                            }
                            textAlign="center"
                            numberOfLines={2}
                            style={{
                              color: selected
                                ? colors.mint600
                                : palette.textPrimary,
                            }}
                          >
                            {t(category.labelKey)}
                          </JzText>
                        </Pressable>
                      );
                    },
                  )}
                </View>
              </YStack>
            )}

            {categoryId ? (
              <>
                <YStack gap={spacing[2]}>
                  <JzText
                    variant="caption"
                    textDirection={textDirection}
                    style={{
                      color:
                        palette.textSecondary,
                    }}
                  >
                    {t('costNameEditable')}
                  </JzText>

                  <TextInput
                    value={title}
                    maxLength={120}
                    autoCorrect
                    returnKeyType="next"
                    placeholder={t(
                      'costNamePlaceholder',
                    )}
                    placeholderTextColor={
                      palette.textMuted
                    }
                    onChangeText={setTitle}
                    style={[
                      styles.textInput,
                      {
                        color:
                          palette.textPrimary,
                        borderColor:
                          palette.borderStrong,
                        backgroundColor:
                          palette.inputBackground,
                        textAlign: isRtl
                          ? 'right'
                          : 'left',
                      },
                    ]}
                  />
                </YStack>

                <YStack gap={spacing[2]}>
                  <JzText
                    variant="caption"
                    textDirection={textDirection}
                    style={{
                      color:
                        palette.textSecondary,
                    }}
                  >
                    {t('costAmount')}
                  </JzText>

                  <View
                    style={[
                      styles.amountShell,
                      {
                        flexDirection: direction,
                        borderColor:
                          palette.borderStrong,
                        backgroundColor:
                          palette.inputBackground,
                      },
                    ]}
                  >
                    <TextInput
                      value={amount}
                      maxLength={13}
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                      placeholder="0"
                      placeholderTextColor={
                        palette.textMuted
                      }
                      onChangeText={(value) =>
                        setAmount(
                          sanitizeMoneyInput(
                            value,
                          ),
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

                  {amountBelowPaid ? (
                    <JzText
                      variant="caption"
                      textDirection={textDirection}
                      style={{
                        color: colors.danger,
                      }}
                    >
                      {t(
                        'costAmountPaidMinimum',
                        {
                          amount: `${formatAmount(
                            minimumAmount,
                            locale,
                          )} ${currency}`,
                        },
                      )}
                    </JzText>
                  ) : null}
                </YStack>
              </>
            ) : null}

            {!isEditing ? (
              <View
                style={[
                  styles.estimatedInfo,
                  {
                    flexDirection: direction,
                    backgroundColor:
                      palette.infoSurface,
                    borderColor:
                      palette.border,
                  },
                ]}
              >
                <JzIcon
                  name="info"
                  size={18}
                  color={colors.sky500}
                  strokeWidth={2.1}
                />

                <JzText
                  flex={1}
                  variant="bodySmall"
                  textDirection={textDirection}
                  style={{
                    color:
                      palette.textSecondary,
                  }}
                >
                  {t(
                    'quickAddEstimatedDefault',
                  )}
                </JzText>
              </View>
            ) : null}
          </ScrollView>

          <View
            style={[
              styles.modalActions,
              {
                paddingBottom: Math.max(
                  insets.bottom,
                  spacing[3],
                ),
                borderTopColor:
                  palette.border,
                backgroundColor:
                  palette.surface,
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(
                isEditing
                  ? 'saveCostChanges'
                  : 'addCost',
              )}
              accessibilityState={{
                disabled: !canSave,
              }}
              disabled={!canSave}
              onPress={handleSave}
              style={({ pressed }) => ({
                opacity: !canSave
                  ? 0.42
                  : pressed
                    ? 0.82
                    : 1,
              })}
            >
              <LinearGradient
                colors={[
                  '#74EDBA',
                  '#2DD7A4',
                  '#22C8AF',
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modalPrimary}
              >
                <JzText
                  variant="title"
                  textDirection={textDirection}
                  style={{
                    color: colors.navy950,
                    textAlign: 'center',
                  }}
                >
                  {t(
                    isEditing
                      ? 'saveCostChanges'
                      : 'addCost',
                  )}
                </JzText>
              </LinearGradient>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('close')}
              onPress={resetAndClose}
              style={({ pressed }) => [
                styles.modalSecondary,
                {
                  opacity: pressed
                    ? 0.78
                    : 1,
                  borderColor:
                    palette.borderStrong,
                  backgroundColor:
                    palette.surfaceMuted,
                },
              ]}
            >
              <JzText
                variant="title"
                textDirection={textDirection}
                style={{
                  color: palette.textPrimary,
                  textAlign: 'center',
                }}
              >
                {t('close')}
              </JzText>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function CostsScreen() {
  const router = useRouter();
  const {
    isRtl,
    locale,
    t,
  } = useJahizLocale();
  const { isDark, palette } = useJahizTheme();
  const workspace = useTripWorkspaceStore(
    (state) => state.workspace,
  );
  const addCostItem = useTripWorkspaceStore(
    (state) => state.addCostItem,
  );
  const updateCostItem =
    useTripWorkspaceStore(
      (state) => state.updateCostItem,
    );
  const removeCostItem =
    useTripWorkspaceStore(
      (state) => state.removeCostItem,
    );
  const markCostsReviewed =
    useTripWorkspaceStore(
      (state) => state.markCostsReviewed,
    );

  const [quickAddOpen, setQuickAddOpen] =
    useState(false);
  const [
    quickCategoryId,
    setQuickCategoryId,
  ] = useState<TripCostCategoryId | null>(
    null,
  );
  const [
    editingCostItem,
    setEditingCostItem,
  ] = useState<TripCostItem | null>(null);
  const [
    actionCostItem,
    setActionCostItem,
  ] = useState<TripCostItem | null>(null);

  const direction = isRtl
    ? 'row-reverse'
    : 'row';
  const align = isRtl
    ? 'flex-end'
    : 'flex-start';
  const textDirection = isRtl
    ? 'rtl'
    : 'ltr';

  const totalCost = useMemo(
    () => selectTotalCost(workspace),
    [workspace],
  );

  const categorySummaries = useMemo(
    () =>
      tripCostCategories.map(
        (category) => {
          const items =
            workspace.costItems.filter(
              (item) =>
                item.categoryId ===
                category.id,
            );

          return {
            ...category,
            items,
            total: items.reduce(
              (sum, item) =>
                sum + item.amount,
              0,
            ),
          };
        },
      ),
    [workspace.costItems],
  );

  const usedCategoryIds = useMemo(
    () =>
      new Set(
        workspace.costItems.map(
          (item) => item.categoryId,
        ),
      ),
    [workspace.costItems],
  );

  const confirmedCount =
    workspace.costItems.filter(
      (item) =>
        item.status === 'confirmed',
    ).length;
  const estimatedCount =
    workspace.costItems.length -
    confirmedCount;
  const canContinue =
    workspace.costItems.length > 0;

  const editingPaidTotal = useMemo(
    () =>
      editingCostItem
        ? workspace.payments
            .filter(
              (payment) =>
                payment.costItemId ===
                  editingCostItem.id &&
                payment.status === 'paid',
            )
            .reduce(
              (sum, payment) =>
                sum + payment.amount,
              0,
            )
        : 0,
    [
      editingCostItem,
      workspace.payments,
    ],
  );

  const bookingCategoryIds = useMemo(
    () =>
      new Set<TripCostCategoryId>([
        'cat-flight',
        'cat-accommodation',
        'cat-visa',
        'cat-car',
        'cat-insurance',
        'cat-activities',
      ]),
    [],
  );

  const bookingPaymentSetupNeeded = useMemo(
    () =>
      workspace.costItems
        .filter((item) =>
          bookingCategoryIds.has(
            item.categoryId,
          ),
        )
        .some((item) => {
          const coveredAmount =
            workspace.payments
              .filter(
                (payment) =>
                  payment.costItemId ===
                    item.id &&
                  (
                    payment.status ===
                      'paid' ||
                    payment.status ===
                      'scheduled'
                  ),
              )
              .reduce(
                (sum, payment) =>
                  sum + payment.amount,
                0,
              );

          return (
            Math.round(
              coveredAmount * 100,
            ) <
            Math.round(item.amount * 100)
          );
        }),
    [
      bookingCategoryIds,
      workspace.costItems,
      workspace.payments,
    ],
  );

  const bookingCategories = useMemo(
    () =>
      categorySummaries.filter(
        (category) =>
          category.items.length > 0 &&
          bookingCategoryIds.has(
            category.id,
          ),
      ),
    [
      bookingCategoryIds,
      categorySummaries,
    ],
  );

  const spendingCategories = useMemo(
    () =>
      categorySummaries.filter(
        (category) =>
          category.items.length > 0 &&
          !bookingCategoryIds.has(
            category.id,
          ),
      ),
    [
      bookingCategoryIds,
      categorySummaries,
    ],
  );

  function openQuickAdd(
    categoryId:
      | TripCostCategoryId
      | null,
  ) {
    setEditingCostItem(null);
    setQuickCategoryId(categoryId);
    setQuickAddOpen(true);
    void Haptics.selectionAsync();
  }

  function openEditCost(
    item: TripCostItem,
  ) {
    setEditingCostItem(item);
    setQuickCategoryId(
      item.categoryId,
    );
    setQuickAddOpen(true);
    void Haptics.selectionAsync();
  }

  function handleSaveCost(input: {
    title: string;
    categoryId: TripCostCategoryId;
    amount: number;
  }) {
    if (editingCostItem) {
      updateCostItem(
        editingCostItem.id,
        input,
      );
    } else {
      const existingCategoryItem =
        workspace.costItems.find(
          (item) =>
            item.categoryId ===
            input.categoryId,
        );

      if (existingCategoryItem) {
        updateCostItem(
          existingCategoryItem.id,
          input,
        );
      } else {
        addCostItem({
          ...input,
          status: 'estimated',
        });
      }
    }

    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType
        .Success,
    );
    setQuickAddOpen(false);
    setQuickCategoryId(null);
    setEditingCostItem(null);
  }

  function handleContinue() {
    if (!canContinue) {
      return;
    }

    markCostsReviewed(true);
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    );
    router.replace(
      bookingPaymentSetupNeeded
        ? {
            pathname: '/payments',
            params: {
              setup: '1',
            },
          }
        : '/',
    );
  }

  function handleSaveAndExit() {
    void Haptics.selectionAsync();
    router.replace('/plan');
  }

  function renderCategoryRows(
    categories:
      typeof categorySummaries,
  ) {
    return (
      <YStack gap={spacing[2]}>
        {categories.map((category) => {
          const item = category.items[0];

          if (!item) {
            return null;
          }

          const visual = tripCostVisualFor(
            category.id,
            isDark,
          );

          return (
            <JzGlassPanel
              key={category.id}
              tone="surface"
              style={[
                styles.categoryRow,
                {
                  borderColor: visual.border,
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
                    styles.categoryIcon,
                    {
                      backgroundColor:
                        visual.surface,
                    },
                  ]}
                >
                  <JzIcon
                    name={category.icon}
                    size={20}
                    color={visual.accent}
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
                    numberOfLines={1}
                    style={{
                      color:
                        palette.textPrimary,
                    }}
                  >
                    {t(category.labelKey)}
                  </JzText>

                  <XStack
                    flexDirection={direction}
                    alignItems="center"
                    gap={spacing[2]}
                    flexWrap="wrap"
                  >
                    <JzText
                      variant="caption"
                      textDirection={textDirection}
                      numberOfLines={1}
                      style={{
                        color:
                          palette.textMuted,
                        maxWidth: '64%',
                      }}
                    >
                      {item.title}
                    </JzText>

                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor:
                            item.status ===
                            'confirmed'
                              ? colors.mint500
                              : visual.accent,
                        },
                      ]}
                    />

                    <JzText
                      variant="caption"
                      textDirection={textDirection}
                      numberOfLines={1}
                      style={{
                        color:
                          item.status ===
                          'confirmed'
                            ? colors.mint600
                            : visual.accent,
                        fontWeight: '800',
                      }}
                    >
                      {item.status ===
                      'confirmed'
                        ? t('confirmedCost')
                        : t('estimatedCost')}
                    </JzText>
                  </XStack>
                </YStack>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(
                    'moreActions',
                  )}
                  onPress={() => {
                    setActionCostItem(item);
                    void Haptics.selectionAsync();
                  }}
                  style={[
                    styles.moreButton,
                    {
                      backgroundColor:
                        palette.surfaceMuted,
                      borderColor:
                        palette.border,
                    },
                  ]}
                >
                  <JzIcon
                    name="more"
                    size={18}
                    color={palette.textPrimary}
                    strokeWidth={2.2}
                  />
                </Pressable>
              </XStack>

              <View
                style={[
                  styles.costRowBottom,
                  {
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
                  numberOfLines={1}
                  style={{
                    color:
                      palette.textSecondary,
                  }}
                >
                  {t(
                    bookingCategoryIds.has(
                      category.id,
                    )
                      ? 'bookingCostsTitle'
                      : 'spendingCostsTitle',
                  )}
                </JzText>

                <JzText
                  variant="title"
                  textDirection="ltr"
                  numberOfLines={1}
                  style={{
                    color:
                      palette.textPrimary,
                  }}
                >
                  {formatAmount(
                    item.amount,
                    locale,
                  )}{' '}
                  {item.currency}
                </JzText>
              </View>
            </JzGlassPanel>
          );
        })}
      </YStack>
    );
  }

  return (
    <>
      <Screen
        topColor={palette.background}
        contentColor={palette.background}
        fixedHeader={
          <JzFlowAppBar
            title={t('costsStepTitle')}
            eyebrow={t('yourPlan')}
            isRtl={isRtl}
            backLabel={t('back')}
            onBackPress={() =>
              router.back()
            }
          />
        }
        fixedFooter={
          <JzFlowFooter
            primaryLabel={t('continue')}
            secondaryLabel={t(
              'saveAndExit',
            )}
            primaryDisabled={!canContinue}
            isRtl={isRtl}
            onPrimaryPress={handleContinue}
            onSecondaryPress={
              handleSaveAndExit
            }
          />
        }
      >
        <JzShellSurface
          isRtl={isRtl}
          style={styles.hero}
        >
          <JzText
            variant="heading2"
            textDirection={textDirection}
            style={{
              color: palette.heroText,
            }}
          >
            {t('tripCostsTitle')}
          </JzText>

          <JzText
            variant="bodySmall"
            textDirection={textDirection}
            numberOfLines={2}
            style={{
              color:
                palette.heroSecondary,
            }}
          >
            {t('tripCostsHelper')}
          </JzText>
        </JzShellSurface>

        <YStack
          marginTop={-14}
          paddingHorizontal={spacing[4]}
          paddingBottom={spacing[5]}
          gap={spacing[3]}
        >
          <JzGlassPanel
            tone="surface"
            style={[
              styles.summaryCard,
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
                  styles.summaryIcon,
                  {
                    backgroundColor:
                      palette.successSurface,
                  },
                ]}
              >
                <JzIcon
                  name="receipt"
                  size={22}
                  color={colors.mint600}
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
                  {t('tripCost')}
                </JzText>

                <JzText
                  variant="heading2"
                  textDirection="ltr"
                  style={{
                    color:
                      palette.textPrimary,
                  }}
                >
                  {formatAmount(
                    totalCost,
                    locale,
                  )}{' '}
                  {workspace.currency}
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
                    'costSummaryCounts',
                    {
                      items:
                        workspace.costItems
                          .length,
                      estimated:
                        estimatedCount,
                      confirmed:
                        confirmedCount,
                    },
                  )}
                </JzText>
              </YStack>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(
                  'quickAddCost',
                )}
                onPress={() =>
                  openQuickAdd(null)
                }
                style={({ pressed }) => [
                  styles.addCostButton,
                  {
                    opacity: pressed
                      ? 0.82
                      : 1,
                    backgroundColor:
                      colors.mint500,
                  },
                ]}
              >
                <JzIcon
                  name="add"
                  size={17}
                  color={colors.navy950}
                  strokeWidth={2.2}
                />

                <JzText
                  variant="bodySmall"
                  textDirection={textDirection}
                  numberOfLines={1}
                  style={{
                    color:
                      colors.navy950,
                    fontWeight: '800',
                  }}
                >
                  {t('quickAddCost')}
                </JzText>
              </Pressable>
            </XStack>
          </JzGlassPanel>

          <XStack
            flexDirection={direction}
            alignItems="flex-start"
            gap={spacing[2]}
            style={[
              styles.costTruthCard,
              {
                backgroundColor:
                  palette.surfaceMuted,
                borderColor:
                  palette.border,
              },
            ]}
          >
            <JzIcon
              name="info"
              size={18}
              color={colors.sky500}
              strokeWidth={2.1}
            />
            <JzText
              flex={1}
              variant="caption"
              textDirection={textDirection}
              style={{
                color:
                  palette.textSecondary,
              }}
            >
              {t('costReviewTruthHelper')}
            </JzText>
          </XStack>

          {bookingCategories.length >
          0 ? (
            <YStack gap={spacing[2]}>
              <YStack
                alignItems={align}
                gap={2}
              >
                <JzText
                  variant="title"
                  textDirection={textDirection}
                  style={{
                    color:
                      palette.textPrimary,
                  }}
                >
                  {t('bookingCostsTitle')}
                </JzText>

                <JzText
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color:
                      palette.textMuted,
                  }}
                >
                  {t(
                    'bookingCostsHelper',
                  )}
                </JzText>
              </YStack>

              {renderCategoryRows(
                bookingCategories,
              )}
            </YStack>
          ) : null}

          {spendingCategories.length >
          0 ? (
            <YStack gap={spacing[2]}>
              <YStack
                alignItems={align}
                gap={2}
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
                    'spendingCostsTitle',
                  )}
                </JzText>

                <JzText
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color:
                      palette.textMuted,
                  }}
                >
                  {t(
                    'spendingCostsHelper',
                  )}
                </JzText>
              </YStack>

              {renderCategoryRows(
                spendingCategories,
              )}
            </YStack>
          ) : null}

          {workspace.costItems.length ===
          0 ? (
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
                  size={22}
                  color={colors.sky500}
                  strokeWidth={2.1}
                />
              </View>

              <YStack
                flex={1}
                alignItems={align}
                gap={2}
              >
                <JzText
                  variant="title"
                  textDirection={textDirection}
                  style={{
                    color:
                      palette.textPrimary,
                  }}
                >
                  {t('costCategories')}
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
                    'costCategoriesHelper',
                  )}
                </JzText>
              </YStack>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(
                  'quickAddCost',
                )}
                onPress={() =>
                  openQuickAdd(null)
                }
                style={({ pressed }) => [
                  styles.emptyAction,
                  {
                    opacity:
                      pressed ? 0.82 : 1,
                    backgroundColor:
                      palette.successSurface,
                    borderColor:
                      'rgba(48,214,162,0.28)',
                  },
                ]}
              >
                <JzIcon
                  name="add"
                  size={18}
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
                  {t('quickAddCost')}
                </JzText>
              </Pressable>
            </JzGlassPanel>
          ) : null}
        </YStack>
      </Screen>

      <JzActionMenuSheet
        visible={actionCostItem !== null}
        title={
          actionCostItem?.title ??
          t('moreActions')
        }
        helper={t('costActionHelper')}
        isRtl={isRtl}
        onClose={() =>
          setActionCostItem(null)
        }
        actions={
          actionCostItem
            ? [
                {
                  key: 'edit',
                  label: t('editCost'),
                  icon: 'edit' as const,
                  onPress: () =>
                    openEditCost(
                      actionCostItem,
                    ),
                },
                {
                  key: 'delete',
                  label: t('removeCost'),
                  icon: 'delete' as const,
                  tone: 'danger' as const,
                  onPress: () => {
                    removeCostItem(
                      actionCostItem.id,
                    );
                    void Haptics.notificationAsync(
                      Haptics
                        .NotificationFeedbackType
                        .Warning,
                    );
                  },
                },
              ]
            : []
        }
      />

      <CostEditorModal
        key={`${quickAddOpen}-${editingCostItem?.id ?? quickCategoryId ?? 'general'}`}
        visible={quickAddOpen}
        initialCategoryId={
          quickCategoryId
        }
        initialItem={editingCostItem}
        minimumAmount={editingPaidTotal}
        usedCategoryIds={usedCategoryIds}
        currency={workspace.currency}
        isRtl={isRtl}
        onClose={() => {
          setQuickAddOpen(false);
          setQuickCategoryId(null);
          setEditingCostItem(null);
        }}
        onSave={handleSaveCost}
      />
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: 30,
    gap: spacing[2],
  },
  costTruthCard: {
    padding: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  summaryCard: {
    padding: spacing[3],
    borderRadius: 22,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  addCostButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
  },
  categoryRow: {
    padding: spacing[3],
    borderRadius: 20,
  },
  categoryIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
  },
  editButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  removeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  moreButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  costRowBottom: {
    minHeight: 48,
    marginTop: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },  emptyCard: {
    padding: spacing[3],
    gap: spacing[3],
    alignItems: 'center',
    borderRadius: 20,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  emptyAction: {
    minHeight: 46,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(4,12,24,0.58)',
  },
  modalSheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth:
      StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    marginTop: spacing[2],
    borderRadius: radius.full,
  },
  modalContent: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
    gap: spacing[4],
  },
  quickIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  selectedCategory: {
    minHeight: 72,
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  selectedCategoryIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  categoryGrid: {
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  categoryChoice: {
    width: '48%',
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    padding: spacing[2],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  textInput: {
    minHeight: 54,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.lg,
    borderWidth: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  amountShell: {
    minHeight: 58,
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  amountInput: {
    flex: 1,
    minHeight: 56,
    paddingVertical: 0,
    fontSize: 22,
    fontWeight: '700',
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
  estimatedInfo: {
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  modalActions: {
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    borderTopWidth:
      StyleSheet.hairlineWidth,
  },
  modalPrimary: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor:
      'rgba(187,255,230,0.64)',
  },
  modalSecondary: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
  },
});