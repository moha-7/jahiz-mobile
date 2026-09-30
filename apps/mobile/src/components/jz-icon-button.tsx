import * as Haptics from 'expo-haptics';
import type { ColorValue } from 'react-native';
import {
  Pressable,
  View,
} from 'react-native';
import { JzIcon, type JzIconName } from './jz-icon';
import { useJahizTheme } from '@/providers/theme-provider';

export type JzIconButtonVariant =
  | 'ghost'
  | 'surface'
  | 'inverse'
  | 'mint'
  | 'danger';

export type JzIconButtonSize = 'sm' | 'md' | 'lg';

export interface JzIconButtonProps {
  icon: JzIconName;
  accessibilityLabel: string;
  onPress?: () => void;
  isRtl?: boolean;
  disabled?: boolean;
  haptic?: boolean;
  showBadge?: boolean;
  badgeColor?: ColorValue;
  variant?: JzIconButtonVariant;
  size?: JzIconButtonSize;
}

const sizeStyles = {
  sm: {
    dimension: 36,
    icon: 18,
  },
  md: {
    dimension: 44,
    icon: 21,
  },
  lg: {
    dimension: 52,
    icon: 24,
  },
} as const;

export function JzIconButton({
  icon,
  accessibilityLabel,
  onPress,
  isRtl = false,
  disabled = false,
  haptic = true,
  showBadge = false,
  badgeColor = '#28D8A1',
  variant = 'surface',
  size = 'md',
}: JzIconButtonProps) {
  const { isDark, palette } = useJahizTheme();
  const dimensions = sizeStyles[size];

  const visual =
    variant === 'ghost'
      ? {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          iconColor: palette.textSecondary,
        }
      : variant === 'surface'
        ? {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            iconColor: palette.textPrimary,
          }
        : variant === 'inverse'
          ? isDark
            ? {
                backgroundColor: '#101B2F',
                borderColor: '#263850',
                iconColor: '#FFFFFF',
              }
            : {
                backgroundColor: 'rgba(255,255,255,0.78)',
                borderColor: 'rgba(94,118,140,0.22)',
                iconColor: palette.heroText,
              }
          : variant === 'mint'
            ? {
                backgroundColor: isDark
                  ? 'rgba(40,216,161,0.14)'
                  : '#E9FBF5',
                borderColor: isDark
                  ? 'rgba(90,226,181,0.30)'
                  : '#C4F3E3',
                iconColor: '#0F9F75',
              }
            : {
                backgroundColor: isDark
                  ? 'rgba(239,68,68,0.15)'
                  : '#FFF1F2',
                borderColor: isDark
                  ? 'rgba(239,68,68,0.30)'
                  : '#FECDD3',
                iconColor: '#E11D48',
              };

  function handlePress() {
    if (disabled) return;

    if (haptic) {
      void Haptics.selectionAsync().catch(
        () => undefined,
      );
    }

    onPress?.();
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={handlePress}
      style={({ pressed }) => ({
        position: 'relative',
        width: dimensions.dimension,
        height: dimensions.dimension,
        minWidth: dimensions.dimension,
        minHeight: dimensions.dimension,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: visual.borderColor,
        backgroundColor: visual.backgroundColor,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled
          ? 0.45
          : pressed
            ? 0.82
            : 1,
        transform: [
          {
            scale:
              pressed && !disabled ? 0.94 : 1,
          },
        ],
      })}
    >
      <JzIcon
        name={icon}
        size={dimensions.icon}
        color={visual.iconColor}
        isRtl={isRtl}
      />

      {showBadge ? (
        <View
          style={{
            position: 'absolute',
            top: 7,
            right: isRtl ? undefined : 7,
            left: isRtl ? 7 : undefined,
            width: 8,
            height: 8,
            borderRadius: 999,
            borderWidth: 1.5,
            borderColor: visual.backgroundColor,
            backgroundColor: badgeColor,
          }}
        />
      ) : null}
    </Pressable>
  );
}
