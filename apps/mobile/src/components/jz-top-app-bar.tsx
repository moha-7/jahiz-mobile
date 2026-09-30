import * as Haptics from 'expo-haptics';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { XStack, YStack } from 'tamagui';
import { JzText } from '@jahiz/ui';
import {
  colors,
  radius,
  spacing,
} from '@jahiz/design-tokens';
import { JzAvatar } from '@/components/jz-avatar';
import { JzIconButton } from '@/components/jz-icon-button';
import { JzShellSurface } from '@/components/jz-shell-surface';
import { useJahizTheme } from '@/providers/theme-provider';

type JzTopAppBarProps = {
  isRtl: boolean;
  brandLabel: string;
  tagline: string;
  notificationLabel: string;
  profileLabel: string;
  transparent?: boolean;
  onNotificationsPress?: () => void;
  onProfilePress: () => void;
};

export function JzTopAppBar({
  isRtl,
  brandLabel,
  tagline,
  notificationLabel,
  profileLabel,
  transparent = false,
  onNotificationsPress,
  onProfilePress,
}: JzTopAppBarProps) {
  const { palette } = useJahizTheme();
  const direction = isRtl ? 'row-reverse' : 'row';
  const align = isRtl ? 'flex-end' : 'flex-start';
  const textDirection = isRtl ? 'rtl' : 'ltr';

  function handleProfilePress() {
    void Haptics.selectionAsync().catch(
      () => undefined,
    );
    onProfilePress();
  }

  const content = (
    <XStack
      minHeight={68}
      paddingHorizontal={spacing[4]}
      paddingVertical={spacing[2]}
      flexDirection={direction}
      alignItems="center"
      justifyContent="space-between"
    >
      <YStack
        alignItems={align}
        gap={2}
      >
        <XStack
          flexDirection={direction}
          alignItems="center"
          gap={7}
        >
          <View style={styles.brandDot} />

          <JzText
            variant="title"
            textDirection={textDirection}
            style={{
              color: palette.heroText,
            }}
          >
            {brandLabel}
          </JzText>
        </XStack>

        <JzText
          variant="caption"
          textDirection={textDirection}
          numberOfLines={1}
          style={{
            color: palette.heroSecondary,
          }}
        >
          {tagline}
        </JzText>
      </YStack>

      <XStack
        flexDirection={direction}
        alignItems="center"
        gap={spacing[2]}
      >
        <JzIconButton
          icon="notifications"
          accessibilityLabel={notificationLabel}
          variant="inverse"
          showBadge
          onPress={onNotificationsPress}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={profileLabel}
          onPress={handleProfilePress}
          hitSlop={8}
          style={({ pressed }) => ({
            opacity: pressed ? 0.8 : 1,
            transform: [
              {
                scale: pressed ? 0.96 : 1,
              },
            ],
          })}
        >
          <JzAvatar initials="MO" />
        </Pressable>
      </XStack>
    </XStack>
  );

  if (transparent) {
    return (
      <View style={styles.transparentSurface}>
        {content}
      </View>
    );
  }

  return (
    <JzShellSurface
      isRtl={isRtl}
      style={[
        styles.surface,
        {
          borderBottomColor: palette.border,
        },
      ]}
    >
      {content}
    </JzShellSurface>
  );
}

const styles = StyleSheet.create({
  surface: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  transparentSurface: {
    backgroundColor: 'transparent',
  },
  brandDot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
    backgroundColor: colors.mint500,
  },
});
