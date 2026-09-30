import { XStack, YStack } from 'tamagui';
import { colors, radius, spacing } from '@jahiz/design-tokens';
import { JzCard } from './JzCard';
import { JzText } from './JzText';

export type JzMoneyCardTone = 'ready' | 'cost' | 'paid' | 'remaining';

export interface JzMoneyCardProps {
  label: string;
  amount: string;
  helper: string;
  isRtl?: boolean;
  tone?: JzMoneyCardTone;
}

const toneStyles = {
  ready: {
    background: '#ECFDF7',
    border: '#C9F3E4',
    accent: colors.mint600,
  },
  cost: {
    background: '#EFF9FF',
    border: '#CDEEFF',
    accent: colors.sky500,
  },
  paid: {
    background: '#F8FAFC',
    border: colors.border,
    accent: colors.textMuted,
  },
  remaining: {
    background: '#FFF7E8',
    border: '#F7DEAE',
    accent: colors.warning,
  },
} as const satisfies Record<
  JzMoneyCardTone,
  {
    background: string;
    border: string;
    accent: string;
  }
>;

export function JzMoneyCard({
  label,
  amount,
  helper,
  isRtl = false,
  tone = 'paid',
}: JzMoneyCardProps) {
  const align = isRtl ? 'flex-end' : 'flex-start';
  const direction = isRtl ? 'row-reverse' : 'row';
  const textDirection = isRtl ? 'rtl' : 'ltr';
  const palette = toneStyles[tone];

  return (
    <JzCard
      compact
      flex={1}
      minWidth={150}
      minHeight={122}
      gap={spacing[2]}
      backgroundColor={palette.background}
      borderColor={palette.border}
    >
      <XStack
        flexDirection={direction}
        justifyContent="space-between"
        alignItems="center"
      >
        <YStack
          width={7}
          height={7}
          borderRadius={radius.full}
          backgroundColor={palette.accent}
        />

        <YStack
          width={30}
          height={30}
          borderRadius={radius.md}
          backgroundColor={colors.surface}
          opacity={0.72}
        />
      </XStack>

      <YStack gap={spacing[1]} alignItems={align}>
        <JzText
          variant="bodySmall"
          color={colors.textSecondary}
          textDirection={textDirection}
        >
          {label}
        </JzText>

        <JzText variant="moneyMedium">{amount}</JzText>

        <JzText
          variant="caption"
          color={palette.accent}
          textDirection={textDirection}
        >
          {helper}
        </JzText>
      </YStack>
    </JzCard>
  );
}
