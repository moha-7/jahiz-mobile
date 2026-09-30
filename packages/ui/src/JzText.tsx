import type { ComponentProps } from 'react';
import { Text } from 'tamagui';
import { colors, typography } from '@jahiz/design-tokens';

type Variant = keyof typeof typography;
type Props = ComponentProps<typeof Text> & {
  variant?: Variant;
  textDirection?: 'ltr' | 'rtl';
};

export function JzText({ variant = 'body', textDirection, style, ...props }: Props) {
  return (
    <Text
      color={colors.textPrimary}
      style={[
        typography[variant],
        textDirection
          ? {
              writingDirection: textDirection,
              textAlign: textDirection === 'rtl' ? 'right' : 'left',
            }
          : null,
        style,
      ]}
      maxFontSizeMultiplier={1.4}
      {...props}
    />
  );
}
