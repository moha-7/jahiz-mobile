import type { PropsWithChildren } from 'react';
import type {
  StyleProp,
  ViewStyle,
} from 'react-native';
import {
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { glass } from '@jahiz/design-tokens';
import { useJahizTheme } from '@/providers/theme-provider';

export type JzGlassTone =
  | 'surface'
  | 'mint'
  | 'sky'
  | 'amber'
  | 'dark';

type JzGlassPanelProps = PropsWithChildren<{
  tone?: JzGlassTone;
  style?: StyleProp<ViewStyle>;
}>;

export function JzGlassPanel({
  tone = 'surface',
  style,
  children,
}: JzGlassPanelProps) {
  const { isDark, palette } = useJahizTheme();

  const colors =
    tone === 'dark'
      ? palette.darkCardGradient
      : tone === 'mint'
        ? palette.mintGradient
        : tone === 'sky'
          ? palette.skyGradient
          : tone === 'amber'
            ? palette.amberGradient
            : palette.surfaceGradient;

  const border =
    tone === 'dark'
      ? glass.darkBorder
      : tone === 'mint'
        ? isDark
          ? 'rgba(88,205,164,0.20)'
          : 'rgba(92,199,161,0.42)'
        : tone === 'sky'
          ? isDark
            ? 'rgba(90,170,211,0.18)'
            : 'rgba(82,174,218,0.42)'
          : tone === 'amber'
            ? isDark
              ? 'rgba(216,165,80,0.18)'
              : 'rgba(222,169,77,0.40)'
            : palette.borderStrong;

  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.base,
        styles.shadow,
        {
          borderColor: border,
          shadowColor: isDark ? '#07111F' : '#2C4158',
          shadowOpacity: isDark ? 0.14 : 0.09,
        },
        style,
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[
          palette.glassHighlight,
          'rgba(255,255,255,0.06)',
          'rgba(255,255,255,0)',
        ]}
        locations={[0, 0.42, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[
          styles.sheen,
          {
            opacity:
              tone === 'dark'
                ? 0.30
                : isDark
                  ? 0.20
                  : 0.64,
          },
        ]}
      />

      <View
        pointerEvents="none"
        style={[
          styles.edgeHighlight,
          {
            opacity:
              tone === 'dark'
                ? 0.26
                : isDark
                  ? 0.15
                  : 0.46,
            backgroundColor:
              palette.glassHighlight,
          },
        ]}
      />

      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '56%',
  },
  edgeHighlight: {
    position: 'absolute',
    top: 1,
    left: 18,
    right: 18,
    height: StyleSheet.hairlineWidth,
  },
  shadow: {
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#07111F',
          shadowOffset: {
            width: 0,
            height: 9,
          },
          shadowOpacity: 0.12,
          shadowRadius: 18,
        }
      : Platform.OS === 'android'
        ? {
            elevation: 4,
          }
        : {}),
  },
});
