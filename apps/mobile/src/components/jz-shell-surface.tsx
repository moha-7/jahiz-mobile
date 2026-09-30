import type { PropsWithChildren } from 'react';
import type {
  StyleProp,
  ViewStyle,
} from 'react-native';
import {
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useJahizTheme } from '@/providers/theme-provider';

type JzShellSurfaceProps = PropsWithChildren<{
  isRtl: boolean;
  accent?: boolean;
  glossy?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

export function JzShellSurface({
  children,
  isRtl,
  accent = true,
  glossy = true,
  style,
}: JzShellSurfaceProps) {
  const { isDark, palette } = useJahizTheme();

  return (
    <LinearGradient
      colors={palette.heroGradient}
      locations={[0, 0.56, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.surface, style]}
    >
      {glossy ? (
        <LinearGradient
          pointerEvents="none"
          colors={
            isDark
              ? [
                  'rgba(255,255,255,0.075)',
                  'rgba(255,255,255,0.018)',
                  'rgba(255,255,255,0)',
                ]
              : [
                  'rgba(255,255,255,0.72)',
                  'rgba(255,255,255,0.22)',
                  'rgba(255,255,255,0)',
                ]
          }
          locations={[0, 0.34, 0.72]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {accent ? (
        <>
          <View
            pointerEvents="none"
            style={[
              styles.accentWash,
              {
                right: isRtl ? undefined : -94,
                left: isRtl ? -94 : undefined,
                backgroundColor: isDark
                  ? 'rgba(40,216,161,0.075)'
                  : 'rgba(40,216,161,0.12)',
              },
            ]}
          />

          <View
            pointerEvents="none"
            style={[
              styles.secondaryWash,
              {
                left: isRtl ? undefined : -84,
                right: isRtl ? -84 : undefined,
                backgroundColor: isDark
                  ? 'rgba(56,189,248,0.045)'
                  : 'rgba(56,189,248,0.10)',
              },
            ]}
          />
        </>
      ) : null}

      <View
        pointerEvents="none"
        style={[
          styles.topHighlight,
          {
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
  surface: {
    position: 'relative',
    overflow: 'hidden',
  },
  accentWash: {
    position: 'absolute',
    top: -66,
    width: 258,
    height: 132,
    borderRadius: 86,
    transform: [{ rotate: '-12deg' }],
  },
  secondaryWash: {
    position: 'absolute',
    bottom: -104,
    width: 214,
    height: 148,
    borderRadius: 92,
    transform: [{ rotate: '14deg' }],
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: StyleSheet.hairlineWidth,
  },
});
