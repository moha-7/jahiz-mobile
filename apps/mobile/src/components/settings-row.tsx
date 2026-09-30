import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
} from 'react-native';
import {
  XStack,
  YStack,
} from 'tamagui';
import { JzText } from '@jahiz/ui';
import {
  colors,
  radius,
  spacing,
  touchTarget,
} from '@jahiz/design-tokens';
import { useJahizTheme } from '@/providers/theme-provider';

type IconName = keyof typeof Ionicons.glyphMap;

type SettingsRowProps = {
  icon: IconName;
  title: string;
  value?: string;
  isRtl: boolean;
  destructive?: boolean;
  onPress?: () => void;
};

export function SettingsRow({
  icon,
  title,
  value,
  isRtl,
  destructive = false,
  onPress,
}: SettingsRowProps) {
  const { palette, isDark } = useJahizTheme();
  const direction = isRtl ? 'row-reverse' : 'row';
  const align = isRtl ? 'flex-end' : 'flex-start';
  const contentColor = destructive
    ? colors.danger
    : palette.textPrimary;
  const codeLikeValue = Boolean(
    value && /^[A-Z0-9.-]+$/.test(value),
  );

  return (
    <Pressable
      accessibilityRole={
        onPress ? 'button' : undefined
      }
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <XStack
        minHeight={62}
        flexDirection={direction}
        alignItems="center"
        gap={spacing[3]}
        paddingHorizontal={spacing[4]}
        paddingVertical={spacing[2]}
      >
        <YStack
          width={touchTarget}
          height={touchTarget}
          borderRadius={radius.md}
          backgroundColor={
            destructive
              ? isDark
                ? 'rgba(239,68,68,0.16)'
                : '#FEE2E2'
              : isDark
                ? 'rgba(40,216,161,0.12)'
                : colors.mint100
          }
          alignItems="center"
          justifyContent="center"
        >
          <Ionicons
            name={icon}
            size={20}
            color={
              destructive
                ? colors.danger
                : colors.mint600
            }
          />
        </YStack>

        <YStack
          flex={1}
          minWidth={0}
          alignItems={align}
        >
          <JzText
            variant="body"
            textDirection={isRtl ? 'rtl' : 'ltr'}
            numberOfLines={1}
            style={{
              color: contentColor,
            }}
          >
            {title}
          </JzText>
        </YStack>

        {value ? (
          <JzText
            variant="bodySmall"
            textDirection={
              codeLikeValue
                ? 'ltr'
                : isRtl
                  ? 'rtl'
                  : 'ltr'
            }
            numberOfLines={1}
            flexShrink={0}
            style={{
              color: palette.textSecondary,
            }}
          >
            {value}
          </JzText>
        ) : null}

        {onPress ? (
          <Ionicons
            name={
              isRtl
                ? 'chevron-back'
                : 'chevron-forward'
            }
            size={18}
            color={palette.textMuted}
          />
        ) : null}
      </XStack>
    </Pressable>
  );
}
