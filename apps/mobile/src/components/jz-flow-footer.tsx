import { LinearGradient } from 'expo-linear-gradient';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { JzText } from '@jahiz/ui';
import {
  colors,
  radius,
  spacing,
} from '@jahiz/design-tokens';
import { useJahizTheme } from '@/providers/theme-provider';

type JzFlowFooterProps = {
  primaryLabel: string;
  secondaryLabel: string;
  primaryDisabled?: boolean;
  isRtl: boolean;
  onPrimaryPress: () => void;
  onSecondaryPress: () => void;
};

export function JzFlowFooter({
  primaryLabel,
  secondaryLabel,
  primaryDisabled = false,
  isRtl,
  onPrimaryPress,
  onSecondaryPress,
}: JzFlowFooterProps) {
  const { palette } = useJahizTheme();
  const textDirection = isRtl
    ? 'rtl'
    : 'ltr';
  const direction = isRtl
    ? 'row-reverse'
    : 'row';

  return (
    <View
      style={[
        styles.root,
        {
          flexDirection: direction,
          backgroundColor:
            palette.background,
          borderTopColor:
            palette.border,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={secondaryLabel}
        onPress={onSecondaryPress}
        style={({ pressed }) => [
          styles.secondary,
          {
            opacity: pressed ? 0.76 : 1,
            backgroundColor:
              palette.surface,
            borderColor:
              palette.borderStrong,
          },
        ]}
      >
        <JzText
          variant="bodySmall"
          textDirection={textDirection}
          numberOfLines={1}
          style={{
            color:
              palette.textPrimary,
            textAlign: 'center',
            fontWeight: '700',
          }}
        >
          {secondaryLabel}
        </JzText>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={primaryLabel}
        accessibilityState={{
          disabled: primaryDisabled,
        }}
        disabled={primaryDisabled}
        onPress={onPrimaryPress}
        style={({ pressed }) => [
          styles.pressable,
          {
            opacity:
              primaryDisabled
                ? 0.42
                : pressed
                  ? 0.82
                  : 1,
          },
        ]}
      >
        <LinearGradient
          colors={[
            '#74EDBA',
            '#2DD7A4',
            '#22C8AF',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.primary}
        >
          <JzText
            variant="body"
            textDirection={textDirection}
            numberOfLines={1}
            style={{
              color: colors.navy950,
              textAlign: 'center',
              fontWeight: '800',
            }}
          >
            {primaryLabel}
          </JzText>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
    borderTopWidth:
      StyleSheet.hairlineWidth,
  },
  pressable: {
    flex: 1.2,
    borderRadius: radius.lg,
  },
  primary: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor:
      'rgba(187,255,230,0.56)',
  },
  secondary: {
    flex: 0.9,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
});
