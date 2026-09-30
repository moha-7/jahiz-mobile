import type {
  PropsWithChildren,
} from 'react';
import {
  useCallback,
  useRef,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect } from "expo-router/react-navigation";
import { radius } from '@jahiz/design-tokens';

type JzFocusHighlightProps =
  PropsWithChildren<{
    active: boolean;
    borderRadius?: number;
  }>;

export function JzFocusHighlight({
  active,
  borderRadius = radius.xl,
  children,
}: JzFocusHighlightProps) {
  const pulse = useRef(
    new Animated.Value(0),
  ).current;

  useFocusEffect(
    useCallback(() => {
      if (!active) {
        pulse.setValue(0);
        return undefined;
      }

      let cancelled = false;
      let staticPulseTimeout:
        ReturnType<typeof setTimeout> | null =
        null;

      void AccessibilityInfo
        .isReduceMotionEnabled()
        .then((reduceMotion) => {
          if (cancelled) {
            return;
          }

          pulse.setValue(0);

          if (reduceMotion) {
            pulse.setValue(0.45);

            staticPulseTimeout =
              setTimeout(
                () => pulse.setValue(0),
                360,
              );

            return;
          }

          Animated.sequence([
            Animated.timing(pulse, {
              toValue: 1,
              duration: 220,
              useNativeDriver: false,
            }),
            Animated.timing(pulse, {
              toValue: 0.24,
              duration: 420,
              useNativeDriver: false,
            }),
            Animated.timing(pulse, {
              toValue: 0,
              duration: 520,
              useNativeDriver: false,
            }),
          ]).start();
        });

      return () => {
        cancelled = true;

        if (staticPulseTimeout) {
          clearTimeout(
            staticPulseTimeout,
          );
        }

        pulse.stopAnimation();
        pulse.setValue(0);
      };
    }, [
      active,
      pulse,
    ]),
  );

  return (
    <View style={styles.root}>
      {children}

      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          {
            borderRadius,
            opacity: pulse,
            shadowOpacity:
              pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.2],
              }),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
  },
  ring: {
    ...StyleSheet.absoluteFill,
    borderWidth: 2,
    borderColor:
      'rgba(48,214,162,0.82)',
    shadowColor: '#30D6A2',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowRadius: 14,
  },
});
