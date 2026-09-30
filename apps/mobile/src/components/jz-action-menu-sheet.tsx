import type { ReactNode } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { YStack } from 'tamagui';
import { JzText } from '@jahiz/ui';
import {
  colors,
  radius,
  spacing,
} from '@jahiz/design-tokens';
import {
  JzIcon,
  type JzIconName,
} from '@/components/jz-icon';
import { useJahizLocale } from '@/providers/locale-provider';
import { useJahizTheme } from '@/providers/theme-provider';

export type JzActionMenuTone =
  | 'default'
  | 'success'
  | 'danger';

export type JzActionMenuItem = {
  key: string;
  label: string;
  icon: JzIconName;
  tone?: JzActionMenuTone;
  disabled?: boolean;
  trailing?: ReactNode;
  onPress: () => void;
};

type JzActionMenuSheetProps = {
  visible: boolean;
  title: string;
  helper?: string;
  isRtl: boolean;
  actions: JzActionMenuItem[];
  onClose: () => void;
};

export function JzActionMenuSheet({
  visible,
  title,
  helper,
  isRtl,
  actions,
  onClose,
}: JzActionMenuSheetProps) {
  const { t } = useJahizLocale();
  const { palette } = useJahizTheme();
  const direction = isRtl ? 'row-reverse' : 'row';
  const align = isRtl ? 'flex-end' : 'flex-start';
  const textDirection = isRtl ? 'rtl' : 'ltr';

  function run(action: JzActionMenuItem) {
    if (action.disabled) {
      return;
    }

    onClose();
    requestAnimationFrame(() => {
      action.onPress();
    });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('close')}
          onPress={onClose}
          style={styles.backdrop}
        />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: palette.surface,
              borderColor: palette.borderStrong,
            },
          ]}
        >
          <View
            style={[
              styles.handle,
              {
                backgroundColor: palette.borderStrong,
              },
            ]}
          />

          <YStack
            alignItems={align}
            gap={2}
          >
            <JzText
              variant="title"
              textDirection={textDirection}
              style={{ color: palette.textPrimary }}
            >
              {title}
            </JzText>

            {helper ? (
              <JzText
                variant="caption"
                textDirection={textDirection}
                style={{ color: palette.textMuted }}
              >
                {helper}
              </JzText>
            ) : null}
          </YStack>

          <YStack gap={spacing[2]}>
            {actions.map((action) => {
              const tone = action.tone ?? 'default';
              const accent =
                tone === 'danger'
                  ? colors.danger
                  : tone === 'success'
                    ? colors.mint600
                    : palette.textPrimary;
              const background =
                tone === 'danger'
                  ? palette.dangerSurface
                  : tone === 'success'
                    ? palette.successSurface
                    : palette.surfaceMuted;
              const border =
                tone === 'danger'
                  ? 'rgba(239,68,68,0.28)'
                  : tone === 'success'
                    ? 'rgba(48,214,162,0.26)'
                    : palette.border;

              return (
                <Pressable
                  key={action.key}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  accessibilityState={{
                    disabled: action.disabled,
                  }}
                  disabled={action.disabled}
                  onPress={() => run(action)}
                  style={({ pressed }) => [
                    styles.action,
                    {
                      flexDirection: direction,
                      opacity: action.disabled
                        ? 0.4
                        : pressed
                          ? 0.76
                          : 1,
                      backgroundColor: background,
                      borderColor: border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.icon,
                      {
                        backgroundColor:
                          palette.backgroundElevated,
                      },
                    ]}
                  >
                    <JzIcon
                      name={action.icon}
                      size={18}
                      color={accent}
                      strokeWidth={2.15}
                    />
                  </View>

                  <JzText
                    flex={1}
                    variant="bodySmall"
                    textDirection={textDirection}
                    style={{
                      color: accent,
                      fontWeight: '800',
                    }}
                  >
                    {action.label}
                  </JzText>

                  {action.trailing}
                </Pressable>
              );
            })}
          </YStack>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('cancel')}
            onPress={onClose}
            style={[
              styles.cancel,
              {
                backgroundColor: palette.surfaceMuted,
                borderColor: palette.border,
              },
            ]}
          >
            <JzText
              variant="bodySmall"
              textDirection={textDirection}
              style={{
                color: palette.textPrimary,
                fontWeight: '800',
              }}
            >
              {t('cancel')}
            </JzText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(3,9,18,0.58)',
  },
  sheet: {
    maxHeight: '72%',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[4],
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
  },
  handle: {
    width: 44,
    height: 5,
    alignSelf: 'center',
    borderRadius: radius.full,
  },
  action: {
    minHeight: 56,
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius: 16,
    borderWidth: 1,
  },
  icon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  cancel: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
  },
});
