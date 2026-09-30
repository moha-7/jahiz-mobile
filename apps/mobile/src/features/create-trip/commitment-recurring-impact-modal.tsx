import {
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {
  XStack,
  YStack,
} from 'tamagui';
import { JzText } from '@jahiz/ui';
import {
  radius,
  spacing,
} from '@jahiz/design-tokens';
import { JzIcon } from '@/components/jz-icon';
import { useJahizLocale } from '@/providers/locale-provider';
import { useJahizTheme } from '@/providers/theme-provider';

type Props = {
  visible: boolean;
  amount: number;
  currency: string;
  dueDate: string;
  locale: 'ar' | 'en';
  isRtl: boolean;
  reflected: boolean;

  onClose: () => void;

  onSetReflected: (
    reflected: boolean,
  ) => void;

  onMarkUnpaid: () => void;
};

function formatAmount(
  value: number,
  locale: 'ar' | 'en',
): string {
  return new Intl.NumberFormat(
    locale === 'ar'
      ? 'ar'
      : 'en-US',
    {
      maximumFractionDigits: 2,
    },
  ).format(value);
}

export function CommitmentRecurringImpactModal({
  visible,
  amount,
  currency,
  dueDate,
  locale,
  isRtl,
  reflected,
  onClose,
  onSetReflected,
  onMarkUnpaid,
}: Props) {
  const { t } =
    useJahizLocale();

  const { palette } =
    useJahizTheme();

  const direction =
    isRtl
      ? 'row-reverse'
      : 'row';

  const textDirection =
    isRtl
      ? 'rtl'
      : 'ltr';

  const amountLabel =
    formatAmount(
      amount,
      locale,
    );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={
        onClose
      }
    >
      <View
        style={
          styles.root
        }
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            t('close')
          }
          onPress={
            onClose
          }
          style={
            styles.backdrop
          }
        />

        <View
          style={[
            styles.sheet,
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
              styles.handle,
              {
                backgroundColor:
                  palette.borderStrong,
              },
            ]}
          />

          <XStack
            flexDirection={
              direction
            }
            alignItems="flex-start"
            justifyContent="space-between"
            gap={spacing[3]}
          >
            <YStack
              flex={1}
              gap={spacing[1]}
            >
              <JzText
                variant="heading2"
                textDirection={
                  textDirection
                }
                style={{
                  color:
                    palette
                      .textPrimary,
                }}
              >
                {t(
                  'commitmentPaidImpactAction',
                )}
              </JzText>

              <JzText
                variant="caption"
                textDirection="ltr"
                style={{
                  color:
                    palette
                      .textMuted,
                  fontWeight:
                    '700',
                }}
              >
                {dueDate}
              </JzText>
            </YStack>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                t('close')
              }
              onPress={
                onClose
              }
              style={[
                styles.closeButton,
                {
                  backgroundColor:
                    palette
                      .surfaceMuted,
                  borderColor:
                    palette.border,
                },
              ]}
            >
              <JzIcon
                name="close"
                size={19}
                color={
                  palette
                    .textPrimary
                }
                strokeWidth={
                  2.1
                }
              />
            </Pressable>
          </XStack>

          <YStack
            gap={spacing[1]}
          >
            <JzText
              variant="body"
              textDirection={
                textDirection
              }
              style={{
                color:
                  palette
                    .textPrimary,
                fontWeight:
                  '800',
              }}
            >
              {t(
                'commitmentPaidMoneyQuestion',
                {
                  amount:
                    amountLabel,
                  currency,
                },
              )}
            </JzText>

            <JzText
              variant="bodySmall"
              textDirection={
                textDirection
              }
              style={{
                color:
                  palette
                    .textSecondary,
              }}
            >
              {t(
                'commitmentPaidMoneyHelper',
              )}
            </JzText>
          </YStack>

          <YStack
            gap={spacing[2]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                selected:
                  !reflected,
              }}
              onPress={() =>
                onSetReflected(
                  false,
                )
              }
              style={[
                styles.choice,
                {
                  backgroundColor:
                    palette.surface,
                  borderColor:
                    !reflected
                      ? palette
                          .borderStrong
                      : palette.border,
                },
              ]}
            >
              <XStack
                flexDirection={
                  direction
                }
                alignItems="center"
                gap={spacing[2]}
              >
                <View
                  style={[
                    styles.radio,
                    {
                      borderColor:
                        !reflected
                          ? palette
                              .textPrimary
                          : palette
                              .borderStrong,
                    },
                  ]}
                >
                  {!reflected ? (
                    <View
                      style={[
                        styles.radioDot,
                        {
                          backgroundColor:
                            palette
                              .textPrimary,
                        },
                      ]}
                    />
                  ) : null}
                </View>

                <JzText
                  flex={1}
                  variant="bodySmall"
                  textDirection={
                    textDirection
                  }
                  style={{
                    color:
                      palette
                        .textPrimary,
                    fontWeight:
                      '700',
                  }}
                >
                  {t(
                    'commitmentPaidKeepDeducted',
                    {
                      amount:
                        amountLabel,
                      currency,
                    },
                  )}
                </JzText>
              </XStack>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                selected:
                  reflected,
              }}
              onPress={() =>
                onSetReflected(
                  true,
                )
              }
              style={[
                styles.choice,
                {
                  backgroundColor:
                    palette.surface,
                  borderColor:
                    reflected
                      ? palette
                          .borderStrong
                      : palette.border,
                },
              ]}
            >
              <XStack
                flexDirection={
                  direction
                }
                alignItems="center"
                gap={spacing[2]}
              >
                <View
                  style={[
                    styles.radio,
                    {
                      borderColor:
                        reflected
                          ? palette
                              .textPrimary
                          : palette
                              .borderStrong,
                    },
                  ]}
                >
                  {reflected ? (
                    <View
                      style={[
                        styles.radioDot,
                        {
                          backgroundColor:
                            palette
                              .textPrimary,
                        },
                      ]}
                    />
                  ) : null}
                </View>

                <JzText
                  flex={1}
                  variant="bodySmall"
                  textDirection={
                    textDirection
                  }
                  style={{
                    color:
                      palette
                        .textPrimary,
                    fontWeight:
                      '700',
                  }}
                >
                  {t(
                    'commitmentPaidMoneyUpdated',
                    {
                      amount:
                        amountLabel,
                      currency,
                    },
                  )}
                </JzText>
              </XStack>
            </Pressable>
          </YStack>

          <View
            style={[
              styles.divider,
              {
                backgroundColor:
                  palette.border,
              },
            ]}
          />

          <Pressable
            accessibilityRole="button"
            onPress={
              onMarkUnpaid
            }
            style={[
              styles.undoButton,
              {
                backgroundColor:
                  palette
                    .surfaceMuted,
                borderColor:
                  palette.border,
              },
            ]}
          >
            <JzText
              variant="bodySmall"
              textDirection={
                textDirection
              }
              style={{
                color:
                  palette
                    .textSecondary,
                fontWeight:
                  '700',
              }}
            >
              {t(
                'commitmentPaidUndoPayment',
              )}
            </JzText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles =
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent:
        'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor:
        'rgba(0,0,0,0.45)',
    },
    sheet: {
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      borderWidth: 1,
      paddingHorizontal:
        spacing[4],
      paddingTop:
        spacing[2],
      paddingBottom:
        spacing[6],
      gap: spacing[4],
    },
    handle: {
      alignSelf: 'center',
      width: 42,
      height: 4,
      borderRadius:
        radius.full,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius:
        radius.full,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent:
        'center',
    },
    choice: {
      minHeight: 58,
      borderRadius: 16,
      borderWidth: 1,
      justifyContent:
        'center',
      paddingHorizontal:
        spacing[3],
      paddingVertical:
        spacing[2],
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius:
        radius.full,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent:
        'center',
    },
    radioDot: {
      width: 9,
      height: 9,
      borderRadius:
        radius.full,
    },
    divider: {
      height:
        StyleSheet.hairlineWidth,
    },
    undoButton: {
      minHeight: 46,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent:
        'center',
      paddingHorizontal:
        spacing[3],
    },
  });
