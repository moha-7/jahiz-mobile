import type {
  PropsWithChildren,
  ReactNode,
} from 'react';
import {
  useCallback,
  useEffect,
  useRef,
} from 'react';
import type {
  ColorValue,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleProp,
  ViewStyle,
} from 'react-native';
import {
  Animated,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect } from "expo-router/react-navigation";
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  radius,
  spacing,
} from '@jahiz/design-tokens';
import { JzShellSurface } from '@/components/jz-shell-surface';
import { JzTopAppBar } from '@/components/jz-top-app-bar';
import { useTabBarMotion } from '@/providers/tab-bar-motion-provider';
import { useJahizTheme } from '@/providers/theme-provider';

const APP_BAR_HEIGHT = 68;
const TAB_BAR_MAX_HEIGHT = 72;
const TAB_BAR_VERTICAL_GAP = 22;

type JzCollapsibleScreenProps =
  PropsWithChildren<{
    isRtl: boolean;
    brandLabel: string;
    tagline: string;
    notificationLabel: string;
    profileLabel: string;
    hero: ReactNode;
    heroHeight?: number;
    bodyOverlap?: number;
    contentColor?: ColorValue;
    bodyStyle?: StyleProp<ViewStyle>;
    bottomPadding?: number;
    resetScrollOnFocus?: boolean;
    onNotificationsPress?: () => void;
    onProfilePress: () => void;
  }>;

export function JzCollapsibleScreen({
  children,
  isRtl,
  brandLabel,
  tagline,
  notificationLabel,
  profileLabel,
  hero,
  heroHeight = 224,
  bodyOverlap = 28,
  contentColor,
  bodyStyle,
  bottomPadding = 104,
  resetScrollOnFocus = true,
  onNotificationsPress,
  onProfilePress,
}: JzCollapsibleScreenProps) {
  const insets = useSafeAreaInsets();
  const { palette } = useJahizTheme();
  const params = useLocalSearchParams<{
    focus?: string;
  }>();
  const scrollRef = useRef<ScrollView | null>(null);
  const localScrollY = useRef(
    new Animated.Value(0),
  ).current;
  const focusPulse = useRef(
    new Animated.Value(0),
  ).current;
  const {
    scrollY: tabBarScrollY,
    reset,
  } = useTabBarMotion();
  const resolvedContentColor =
    contentColor ?? palette.background;
  const headerHeight =
    insets.top + APP_BAR_HEIGHT;
  const tabSafeInset =
    insets.bottom +
    TAB_BAR_MAX_HEIGHT +
    TAB_BAR_VERTICAL_GAP;
  const resolvedBottomPadding = Math.max(
    bottomPadding,
    tabSafeInset,
  );

  useEffect(
    () => () => {
      reset();
    },
    [reset],
  );

  useFocusEffect(
    useCallback(() => {
      if (resetScrollOnFocus) {
        scrollRef.current?.scrollTo({
          y: 0,
          animated: false,
        });
        localScrollY.setValue(0);
        tabBarScrollY.setValue(0);
        reset();
      }

      if (params.focus) {
        focusPulse.setValue(0);
        Animated.sequence([
          Animated.timing(focusPulse, {
            toValue: 1,
            duration: 220,
            useNativeDriver: false,
          }),
          Animated.timing(focusPulse, {
            toValue: 0.24,
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
      focusPulse,
      localScrollY,
      params.focus,
      reset,
      resetScrollOnFocus,
      tabBarScrollY,
    ]),
  );

  const backdropOpacity =
    localScrollY.interpolate({
      inputRange: [0, 24, 84],
      outputRange: [0, 0.48, 1],
      extrapolate: 'clamp',
    });

  const heroParallax =
    localScrollY.interpolate({
      inputRange: [-120, 0, 180],
      outputRange: [-12, 0, 28],
      extrapolate: 'clamp',
    });

  const heroContentTranslateY =
    localScrollY.interpolate({
      inputRange: [0, 180],
      outputRange: [0, -22],
      extrapolate: 'clamp',
    });

  const heroContentOpacity =
    localScrollY.interpolate({
      inputRange: [0, 72, 140],
      outputRange: [1, 0.58, 0],
      extrapolate: 'clamp',
    });

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: palette.background,
        },
      ]}
    >
      <Animated.ScrollView
        ref={scrollRef}
        style={[
          styles.scroll,
          {
            backgroundColor:
              palette.background,
          },
        ]}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom:
              resolvedBottomPadding,
            backgroundColor:
              resolvedContentColor,
          },
        ]}
        scrollIndicatorInsets={{
          bottom: resolvedBottomPadding,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces
        alwaysBounceVertical={false}
        overScrollMode="never"
        contentInsetAdjustmentBehavior="never"
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [
            {
              nativeEvent: {
                contentOffset: {
                  y: localScrollY,
                },
              },
            },
          ],
          {
            useNativeDriver: false,
            listener: (
              event: NativeSyntheticEvent<NativeScrollEvent>,
            ) => {
              tabBarScrollY.setValue(
                Math.max(
                  0,
                  event.nativeEvent
                    .contentOffset.y,
                ),
              );
            },
          },
        )}
      >
        <Animated.View
          style={{
            transform: [
              {
                translateY: heroParallax,
              },
            ],
          }}
        >
          <JzShellSurface
            isRtl={isRtl}
            style={[
              styles.hero,
              {
                minHeight:
                  heroHeight + insets.top,
                paddingTop: headerHeight,
              },
            ]}
          >
            <Animated.View
              style={{
                opacity: heroContentOpacity,
                transform: [
                  {
                    translateY:
                      heroContentTranslateY,
                  },
                ],
              }}
            >
              {hero}
            </Animated.View>
          </JzShellSurface>
        </Animated.View>

        <Animated.View
          style={[
            styles.bodySheet,
            {
              marginTop: -bodyOverlap,
              backgroundColor:
                resolvedContentColor,
              borderColor:
                'rgba(48,214,162,0.82)',
              shadowOpacity:
                focusPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.20],
                }),
            },
            bodyStyle,
          ]}
        >
          {children}

          <Animated.View
            pointerEvents="none"
            style={[
              styles.focusRing,
              {
                opacity: focusPulse,
              },
            ]}
          />
        </Animated.View>
      </Animated.ScrollView>

      <View
        pointerEvents="box-none"
        style={styles.headerOverlay}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.headerBackdrop,
            {
              height: headerHeight,
              opacity: backdropOpacity,
            },
          ]}
        >
          <JzShellSurface
            isRtl={isRtl}
            accent={false}
            style={styles.fill}
          />
        </Animated.View>

        <View
          style={[
            styles.headerContent,
            {
              paddingTop: insets.top,
            },
          ]}
        >
          <JzTopAppBar
            isRtl={isRtl}
            brandLabel={brandLabel}
            tagline={tagline}
            notificationLabel={
              notificationLabel
            }
            profileLabel={profileLabel}
            transparent
            onNotificationsPress={
              onNotificationsPress
            }
            onProfilePress={onProfilePress}
          />
        </View>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.headerDivider,
            {
              top:
                headerHeight -
                StyleSheet.hairlineWidth,
              opacity: backdropOpacity,
              backgroundColor:
                palette.border,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 0,
  },
  hero: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[8],
  },
  bodySheet: {
    position: 'relative',
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    shadowColor: '#30D6A2',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowRadius: 16,
  },
  focusRing: {
    ...StyleSheet.absoluteFill,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderWidth: 2,
    borderColor:
      'rgba(48,214,162,0.82)',
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 20,
  },
  headerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  headerContent: {
    minHeight: APP_BAR_HEIGHT,
  },
  headerDivider: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  fill: {
    flex: 1,
  },
});
