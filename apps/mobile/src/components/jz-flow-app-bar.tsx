import { XStack, YStack } from 'tamagui';
import { JzText } from '@jahiz/ui';
import { spacing } from '@jahiz/design-tokens';
import { JzIconButton } from '@/components/jz-icon-button';
import { JzShellSurface } from '@/components/jz-shell-surface';
import { useJahizTheme } from '@/providers/theme-provider';

type JzFlowAppBarProps = {
  title: string;
  eyebrow?: string;
  isRtl: boolean;
  backLabel: string;
  onBackPress: () => void;
};

export function JzFlowAppBar({
  title,
  eyebrow,
  isRtl,
  backLabel,
  onBackPress,
}: JzFlowAppBarProps) {
  const { palette } = useJahizTheme();
  const direction = isRtl ? 'row-reverse' : 'row';
  const align = isRtl ? 'flex-end' : 'flex-start';
  const textDirection = isRtl ? 'rtl' : 'ltr';

  return (
    <JzShellSurface
      isRtl={isRtl}
      accent={false}
      style={{
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
      }}
    >
      <XStack
        minHeight={70}
        paddingHorizontal={spacing[4]}
        paddingVertical={spacing[2]}
        flexDirection={direction}
        alignItems="center"
        gap={spacing[3]}
      >
        <JzIconButton
          icon="back"
          accessibilityLabel={backLabel}
          variant="inverse"
          isRtl={isRtl}
          onPress={onBackPress}
        />

        <YStack
          flex={1}
          alignItems={align}
          gap={1}
        >
          {eyebrow ? (
            <JzText
              variant="caption"
              textDirection={textDirection}
              style={{
                color: palette.heroSecondary,
              }}
            >
              {eyebrow}
            </JzText>
          ) : null}

          <JzText
            variant="title"
            textDirection={textDirection}
            style={{
              color: palette.heroText,
            }}
          >
            {title}
          </JzText>
        </YStack>
      </XStack>
    </JzShellSurface>
  );
}
