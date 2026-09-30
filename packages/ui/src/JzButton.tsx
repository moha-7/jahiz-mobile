import type { ComponentProps } from 'react';
import { Platform } from 'react-native';
import { Button } from 'tamagui';
import { colors, radius, touchTarget } from '@jahiz/design-tokens';

type Props = ComponentProps<typeof Button> & {
  tone?: 'primary' | 'secondary';
  compact?: boolean;
};

export function JzButton({
  tone = 'primary',
  compact = false,
  accessibilityLabel,
  paddingHorizontal,
  ...props
}: Props) {
  const primary = tone === 'primary';
  const webAccessibility = Platform.OS === 'web' && accessibilityLabel
    ? ({ 'aria-label': accessibilityLabel } as Record<string, string>)
    : {};

  return (
    <Button
      minHeight={touchTarget}
      borderRadius={compact ? radius.full : radius.lg}
      paddingHorizontal={paddingHorizontal ?? (compact ? 14 : 18)}
      backgroundColor={primary ? colors.mint500 : colors.surface}
      borderColor={primary ? colors.mint500 : colors.borderStrong}
      borderWidth={1}
      color={colors.navy950}
      fontWeight="700"
      pressStyle={{ opacity: 0.82, scale: 0.99 }}
      accessibilityLabel={Platform.OS === 'web' ? undefined : accessibilityLabel}
      {...webAccessibility}
      {...props}
    />
  );
}
