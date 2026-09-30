import type {
  PropsWithChildren,
  ReactNode,
} from 'react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type {
  ColorValue,
} from 'react-native';
import {
  Animated,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect } from "expo-router/react-navigation";
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  radius,
  spacing,
} from '@jahiz/design-tokens';
import { useJahizTheme } from '@/providers/theme-provider';

interface ScreenProps extends PropsWithChildren {
  topColor?: ColorValue;
  contentColor?: ColorValue;
  bottomPadding?: number;
  fixedHeader?: ReactNode;
  fixedFooter?: ReactNode;
  allowBounce?: boolean;
  hideFooterWhenKeyboardOpen?: boolean;
}

export function Screen({
  children,
  fixedHeader,
  fixedFooter,
  topColor,
  contentColor,
  bottomPadding = spacing[6],
  allowBounce = false,
  hideFooterWhenKeyboardOpen = true,
}: ScreenProps) {
  const { palette } = useJahizTheme();
  const params = useLocalSearchParams<{
    focus?: string;
  }>();
  const [keyboardVisible, setKeyboardVisible] =
    useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const entry = useRef(
    new Animated.Value(0),
  ).current;
  const focusPulse = useRef(
    new Animated.Value(0),
  ).current;
  const resolvedTopColor =
    topColor ?? palette.background;
  const resolvedContentColor =
    contentColor ?? palette.background;

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true),
    );
    const hideSubscription = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false),
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({
        y: 0,
        animated: false,
      });

      entry.setValue(0);
      Animated.timing(entry, {
        toValue: 1,
        duration: 230,
        useNativeDriver: true,
      }).start();

      if (params.focus) {
        focusPulse.setValue(0);
        Animated.sequence([
          Animated.timing(focusPulse, {
            toValue: 1,
            duration: 220,
            useNativeDriver: false,
          }),
          Animated.timing(focusPulse, {
            toValue: 0.28,
            duration: 420,
            useNativeDriver: false,
          }),
          Animated.timing(focusPulse, {
            toValue: 0,
            duration: 520,
            useNativeDriver: false,
          }),
        ]).start();
      }

      return undefined;
    }, [
      entry,
      focusPulse,
      params.focus,
    ]),
  );

  const showFooter = Boolean(
    fixedFooter &&
      (!hideFooterWhenKeyboardOpen ||
        !keyboardVisible),
  );

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: resolvedTopColor,
      }}
      edges={['top']}
    >
      {fixedHeader ? (
        <View
          style={[
            styles.fixedHeaderShield,
            {
              backgroundColor:
                resolvedTopColor,
            },
          ]}
        >
          {fixedHeader}
        </View>
      ) : null}

      <Animated.ScrollView
        ref={scrollRef}
        style={{
          flex: 1,
          opacity: entry,
          transform: [
            {
              translateY: entry.interpolate({
                inputRange: [0, 1],
                outputRange: [7, 0],
              }),
            },
          ],
          backgroundColor: resolvedContentColor,
        }}
        contentContainerStyle={{
          paddingBottom: showFooter
            ? spacing[4]
            : bottomPadding,
          backgroundColor: resolvedContentColor,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={
          Platform.OS === 'ios'
            ? 'interactive'
            : 'on-drag'
        }
        showsVerticalScrollIndicator={false}
        bounces={allowBounce}
        alwaysBounceVertical={allowBounce}
        overScrollMode={
          allowBounce ? 'auto' : 'never'
        }
        contentInsetAdjustmentBehavior="never"
      >
        <View
          style={[
            styles.content,
            {
              backgroundColor:
                resolvedContentColor,
            },
          ]}
        >
          {children}

          <Animated.View
            pointerEvents="none"
            style={[
              styles.focusRing,
              {
                opacity: focusPulse,
                borderColor:
                  'rgba(48,214,162,0.82)',
                shadowOpacity: focusPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.24],
                }),
              },
            ]}
          />
        </View>
      </Animated.ScrollView>

      {showFooter ? (
        <SafeAreaView
          edges={['bottom']}
          style={{
            backgroundColor: palette.background,
          }}
        >
          {fixedFooter}
        </SafeAreaView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fixedHeaderShield: {
    zIndex: 30,
    elevation: 30,
  },
  content: {
    position: 'relative',
  },
  focusRing: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.xxl,
    borderWidth: 2,
    shadowColor: '#30D6A2',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowRadius: 14,
  },
});
