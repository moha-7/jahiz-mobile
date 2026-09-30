import type { ComponentProps } from 'react';
import { YStack } from 'tamagui';
import { colors, radius, spacing } from '@jahiz/design-tokens';

type Props = ComponentProps<typeof YStack> & { compact?: boolean };

export function JzCard({ compact = false, ...props }: Props) {
  return (
    <YStack
      backgroundColor={colors.surface}
      borderColor={colors.border}
      borderWidth={1}
      borderRadius={radius.xl}
      padding={compact ? spacing[4] : spacing[5]}
      {...props}
    />
  );
}
