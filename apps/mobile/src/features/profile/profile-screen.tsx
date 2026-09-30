import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import {
  Alert,
  Pressable,
} from 'react-native';
import {
  Separator,
  YStack,
} from 'tamagui';
import { JzText } from '@jahiz/ui';
import {
  spacing,
} from '@jahiz/design-tokens';
import { JzAvatar } from '@/components/jz-avatar';
import { JzCollapsibleScreen } from '@/components/jz-collapsible-screen';
import { JzGlassPanel } from '@/components/jz-glass-panel';
import { SettingsRow } from '@/components/settings-row';
import { useJahizLocale } from '@/providers/locale-provider';
import {
  useJahizAuthRuntime,
} from '@/providers/jahiz-auth-runtime-provider';
import {
  useJahizTheme,
  type JahizThemePreference,
} from '@/providers/theme-provider';

export function ProfileScreen() {
  const router = useRouter();

  const {
    mode: authMode,
    signOut,
  } = useJahizAuthRuntime();
  const {
    isRtl,
    locale,
    t,
    toggleLocale,
  } = useJahizLocale();
  const {
    preference,
    palette,
    setThemePreference,
  } = useJahizTheme();
  const align = isRtl ? 'flex-end' : 'flex-start';
  const textDirection = isRtl ? 'rtl' : 'ltr';
  const appVersion =
    Constants.expoConfig?.version ??
    'Development';

  function handleLanguagePress() {
    void Haptics.selectionAsync();
    toggleLocale();
  }

  function themePreferenceLabel(
    value: JahizThemePreference,
  ): string {
    if (value === 'light') {
      return t('themeLight');
    }

    if (value === 'dark') {
      return t('themeDark');
    }

    return t('themeSystem');
  }

  function applyTheme(
    value: JahizThemePreference,
  ) {
    void Haptics.selectionAsync();
    setThemePreference(value);
  }

  function handleThemePress() {
    Alert.alert(
      t('theme'),
      t('themeHelper'),
      [
        {
          text: t('themeSystem'),
          onPress: () => applyTheme('system'),
        },
        {
          text: t('themeLight'),
          onPress: () => applyTheme('light'),
        },
        {
          text: t('themeDark'),
          onPress: () => applyTheme('dark'),
        },
        {
          text: t('cancel'),
          style: 'cancel',
        },
      ],
    );
  }

  async function handleSignOutPress() {
    void Haptics.notificationAsync(
      Haptics
        .NotificationFeedbackType
        .Warning,
    );

    if (authMode !== 'clerk') {
      return;
    }

    try {
      await signOut();
    } catch {
      Alert.alert(
        t('signOut'),
        locale === 'ar'
          ? 'تعذر تسجيل الخروج. حاول مرة أخرى.'
          : 'Could not sign out. Please try again.',
      );
    }
  }

  const hero = (
    <YStack
      alignItems="center"
      paddingTop={spacing[5]}
      paddingBottom={spacing[4]}
      gap={spacing[2]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('back')}
        onPress={() => router.back()}
        style={{
          alignSelf: isRtl
            ? 'flex-end'
            : 'flex-start',
          paddingHorizontal: spacing[2],
          paddingVertical: spacing[1],
        }}
      >
        <JzText
          variant="bodySmall"
          textDirection={textDirection}
          style={{
            color: palette.heroSecondary,
            fontWeight: '800',
          }}
        >
          {t('back')}
        </JzText>
      </Pressable>

      <JzAvatar
        initials="MO"
        size={66}
      />

      <JzText
        variant="heading2"
        textDirection={textDirection}
        style={{
          color: palette.heroText,
        }}
      >
        {t('userFullName')}
      </JzText>

      <JzText
        variant="bodySmall"
        textDirection="ltr"
        style={{
          color: palette.heroSecondary,
        }}
      >
        mohamed.osama@ugc.ae
      </JzText>
    </YStack>
  );

  return (
    <JzCollapsibleScreen
      isRtl={isRtl}
      brandLabel={t('brandName')}
      tagline={t('appTagline')}
      notificationLabel={t('notifications')}
      profileLabel={t('profile')}
      hero={hero}
      heroHeight={294}
      bodyOverlap={24}
      contentColor={palette.background}
      bodyStyle={[
        styles.body,
        {
          backgroundColor: palette.background,
        },
      ]}
      bottomPadding={104}
      onProfilePress={() => undefined}
    >
      <YStack
        gap={spacing[2]}
        alignItems={align}
      >
        <JzText
          variant="caption"
          textDirection={textDirection}
          style={{
            color: palette.textSecondary,
          }}
        >
          {t('preferences')}
        </JzText>

        <JzGlassPanel
          tone="surface"
          style={styles.settingsPanel}
        >
          <SettingsRow
            icon="language-outline"
            title={t('language')}
            value={
              locale === 'ar'
                ? t('arabic')
                : t('english')
            }
            isRtl={isRtl}
            onPress={handleLanguagePress}
          />

          <Separator
            style={{
              borderColor: palette.border,
            }}
          />

          <SettingsRow
            icon="contrast-outline"
            title={t('theme')}
            value={themePreferenceLabel(preference)}
            isRtl={isRtl}
            onPress={handleThemePress}
          />

          <Separator
            style={{
              borderColor: palette.border,
            }}
          />

          <SettingsRow
            icon="card-outline"
            title={t('defaultCurrency')}
            value="AED"
            isRtl={isRtl}
            onPress={() =>
              void Haptics.selectionAsync()
            }
          />

          <Separator
            style={{
              borderColor: palette.border,
            }}
          />

          <SettingsRow
            icon="airplane-outline"
            title={t('homeAirport')}
            value="DXB"
            isRtl={isRtl}
            onPress={() =>
              router.push('/trip/create/route')
            }
          />

          <Separator
            style={{
              borderColor: palette.border,
            }}
          />

          <SettingsRow
            icon="notifications-outline"
            title={t('notifications')}
            value={t('enabled')}
            isRtl={isRtl}
            onPress={() =>
              void Haptics.selectionAsync()
            }
          />
        </JzGlassPanel>
      </YStack>

      <YStack
        gap={spacing[2]}
        alignItems={align}
      >
        <JzText
          variant="caption"
          textDirection={textDirection}
          style={{
            color: palette.textSecondary,
          }}
        >
          {t('account')}
        </JzText>

        <JzGlassPanel
          tone="surface"
          style={styles.settingsPanel}
        >
          <SettingsRow
            icon="shield-checkmark-outline"
            title={t('privacyData')}
            isRtl={isRtl}
            onPress={() =>
              void Haptics.selectionAsync()
            }
          />

          <Separator
            style={{
              borderColor: palette.border,
            }}
          />

          <SettingsRow
            icon="information-circle-outline"
            title={t('appVersion')}
            value={appVersion}
            isRtl={isRtl}
          />

          <Separator
            style={{
              borderColor: palette.border,
            }}
          />

          <SettingsRow
            icon="log-out-outline"
            title={t('signOut')}
            isRtl={isRtl}
            destructive
            onPress={() => {
              void handleSignOutPress();
            }}
          />
        </JzGlassPanel>
      </YStack>
    </JzCollapsibleScreen>
  );
}

const styles = {
  body: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[5],
    gap: spacing[5],
  },
  settingsPanel: {
    alignSelf: 'stretch',
    overflow: 'hidden',
    borderRadius: 24,
  },
} as const;
