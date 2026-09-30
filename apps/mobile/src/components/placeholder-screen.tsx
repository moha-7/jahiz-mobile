import { useRouter } from 'expo-router';
import { YStack } from 'tamagui';
import { JzText } from '@jahiz/ui';
import {
  spacing,
} from '@jahiz/design-tokens';
import { JzTopAppBar } from '@/components/jz-top-app-bar';
import { Screen } from './screen';
import { useJahizLocale } from '@/providers/locale-provider';
import { useJahizTheme } from '@/providers/theme-provider';

export function PlaceholderScreen({
  title,
}: {
  title: string;
}) {
  const router = useRouter();
  const { isRtl, t } = useJahizLocale();
  const { palette } = useJahizTheme();
  const align = isRtl ? 'flex-end' : 'flex-start';
  const textDirection = isRtl ? 'rtl' : 'ltr';

  return (
    <Screen
      topColor={palette.background}
      contentColor={palette.background}
      bottomPadding={104}
      fixedHeader={
        <JzTopAppBar
          isRtl={isRtl}
          brandLabel={t('brandName')}
          tagline={t('appTagline')}
          notificationLabel={t('notifications')}
          profileLabel={t('profile')}
          onProfilePress={() =>
            router.push('/profile')
          }
        />
      }
    >
      <YStack
        padding={spacing[6]}
        gap={spacing[3]}
        alignItems={align}
      >
        <JzText
          variant="heading1"
          textDirection={textDirection}
          style={{
            color: palette.textPrimary,
          }}
        >
          {title}
        </JzText>

        <JzText
          textDirection={textDirection}
          style={{
            color: palette.textSecondary,
          }}
        >
          {t('verticalSlicePlaceholder')}
        </JzText>
      </YStack>
    </Screen>
  );
}
