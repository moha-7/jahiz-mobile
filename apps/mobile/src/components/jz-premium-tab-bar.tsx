import type { BottomTabBarProps } from "expo-router/js-tabs";
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@jahiz/design-tokens';
import {
  JzIcon,
  type JzIconName,
} from '@/components/jz-icon';
import { useTabBarMotion } from '@/providers/tab-bar-motion-provider';
import { useJahizTheme } from '@/providers/theme-provider';

type PremiumTabName =
  | 'index'
  | 'plan'
  | 'moves'
  | 'payments';

type JzPremiumTabBarProps = BottomTabBarProps & {
  isRtl: boolean;
  labels: Record<PremiumTabName, string>;
};

const tabIcons: Record<PremiumTabName, JzIconName> = {
  index: 'home',
  plan: 'plan',
  moves: 'next',
  payments: 'payments',
};

function isPremiumTabName(
  value: string,
): value is PremiumTabName {
  return value in tabIcons;
}

export function JzPremiumTabBar({
  state,
  descriptors,
  navigation,
  isRtl,
  labels,
}: JzPremiumTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } =
    useWindowDimensions();
  const { isDark, palette } = useJahizTheme();
  const { scrollY, reset } = useTabBarMotion();

  const direction = isRtl
    ? 'row-reverse'
    : 'row';

  const writingDirection = isRtl
    ? 'rtl'
    : 'ltr';

  useEffect(() => {
    reset();
  }, [reset, state.index]);

  const collapse = scrollY.interpolate({
    inputRange: [0, 34, 110],
    outputRange: [0, 0.34, 1],
    extrapolate: 'clamp',
  });

  const expandedWidth = Math.min(
    viewportWidth - 24,
    760,
  );

  const compactWidth = Math.min(
    Math.max(268, viewportWidth * 0.70),
    expandedWidth - 68,
  );

  const frameWidth = collapse.interpolate({
    inputRange: [0, 1],
    outputRange: [
      expandedWidth,
      compactWidth,
    ],
  });

  const frameHeight = collapse.interpolate({
    inputRange: [0, 1],
    outputRange: [68, 54],
  });

  const itemHeight = collapse.interpolate({
    inputRange: [0, 1],
    outputRange: [58, 44],
  });

  const labelOpacity = collapse.interpolate({
    inputRange: [0, 0.36, 0.72, 1],
    outputRange: [1, 0.76, 0.08, 0],
  });

  const labelHeight = collapse.interpolate({
    inputRange: [0, 0.70, 1],
    outputRange: [18, 4, 0],
  });

  const labelTranslateY = collapse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 4],
  });

  const iconTranslateY = collapse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const activeScale = collapse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.96],
  });

  const surfaceShieldOpacity =
    collapse.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0.35],
    });

  const inactiveForeground = isDark
    ? '#DCE6EF'
    : palette.tabInactive;

  const inactiveBackground = isDark
    ? 'transparent'
    : 'rgba(255,255,255,0.18)';

  const inactivePressedBackground = isDark
    ? 'rgba(220,230,239,0.08)'
    : 'rgba(83,106,128,0.08)';

  const surfaceShieldColor = isDark
    ? 'rgba(7,12,20,0.30)'
    : 'rgba(250,253,255,0.46)';

  const activeGlossColors = isDark
    ? ([
        'rgba(255,255,255,0.58)',
        'rgba(255,255,255,0.07)',
        'rgba(255,255,255,0)',
      ] as const)
    : ([
        'rgba(255,255,255,0.54)',
        'rgba(255,255,255,0.055)',
        'rgba(255,255,255,0)',
      ] as const);

  const glassColors = isDark
    ? ([
        'rgba(21,28,38,0.99)',
        'rgba(15,23,33,0.99)',
        'rgba(11,18,27,0.99)',
      ] as const)
    : ([
        'rgba(255,255,255,0.97)',
        'rgba(248,251,255,0.95)',
        'rgba(235,242,249,0.96)',
      ] as const);

  const glossColors = isDark
    ? ([
        'rgba(255,255,255,0.08)',
        'rgba(255,255,255,0.018)',
        'rgba(255,255,255,0)',
      ] as const)
    : ([
        'rgba(255,255,255,0.98)',
        'rgba(255,255,255,0.46)',
        'rgba(255,255,255,0)',
      ] as const);

  const innerEdgeColor = isDark
    ? 'rgba(255,255,255,0.07)'
    : 'rgba(255,255,255,0.88)';

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.overlay,
        {
          paddingBottom: Math.max(
            insets.bottom,
            7,
          ),
        },
      ]}
    >
      <Animated.View
        style={[
          styles.shadowHost,
          {
            width: frameWidth,
            height: frameHeight,
            shadowColor: isDark
              ? '#000000'
              : '#24364D',
            shadowOpacity: isDark
              ? 0.34
              : 0.24,
          },
        ]}
      >
        <View
          style={[
            styles.frame,
            {
              borderColor: isDark
                ? 'rgba(216,235,247,0.28)'
                : 'rgba(93,113,135,0.25)',
            },
          ]}
        >
          <LinearGradient
            colors={glassColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={[
              styles.bar,
              {
                flexDirection: direction,
              },
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.surfaceShield,
                {
                  backgroundColor:
                    surfaceShieldColor,
                  opacity:
                    surfaceShieldOpacity,
                },
              ]}
            />

            <LinearGradient
              pointerEvents="none"
              colors={glossColors}
              start={{ x: 0.15, y: 0 }}
              end={{ x: 0.85, y: 1 }}
              style={styles.gloss}
            />

            <View
              pointerEvents="none"
              style={[
                styles.innerEdge,
                {
                  borderColor:
                    innerEdgeColor,
                },
              ]}
            />

            {state.routes.map(
              (route, index) => {
                if (
                  !isPremiumTabName(
                    route.name,
                  )
                ) {
                  return null;
                }

                const focused =
                  state.index === index;

                const options =
                  descriptors[route.key]
                    ?.options ?? {};

                const label =
                  labels[route.name];

                function handlePress() {
                  const event =
                    navigation.emit({
                      type: 'tabPress',
                      target: route.key,
                      canPreventDefault:
                        true,
                    });

                  if (
                    !focused &&
                    !event.defaultPrevented
                  ) {
                    void Haptics
                      .selectionAsync()
                      .catch(
                        () => undefined,
                      );

                    navigation.navigate(
                      route.name,
                      route.params,
                    );
                  }
                }

                function handleLongPress() {
                  navigation.emit({
                    type: 'tabLongPress',
                    target: route.key,
                  });
                }

                const foregroundColor =
                  focused
                    ? colors.navy950
                    : inactiveForeground;

                const content = (
                  <View
                    pointerEvents="none"
                    style={styles.foreground}
                  >
                    <Animated.View
                      style={[
                        styles.iconShell,
                        {
                          transform: [
                            {
                              translateY:
                                iconTranslateY,
                            },
                          ],
                        },
                      ]}
                    >
                      <JzIcon
                        name={
                          tabIcons[
                            route.name
                          ]
                        }
                        size={
                          focused
                            ? 24
                            : 22
                        }
                        color={
                          foregroundColor
                        }
                        strokeWidth={
                          focused
                            ? 2.45
                            : 2.05
                        }
                      />
                    </Animated.View>

                    <Animated.View
                      style={[
                        styles.labelShell,
                        {
                          height:
                            labelHeight,
                          opacity:
                            labelOpacity,
                          transform: [
                            {
                              translateY:
                                labelTranslateY,
                            },
                          ],
                        },
                      ]}
                    >
                      <Animated.Text
                        numberOfLines={1}
                        maxFontSizeMultiplier={1.2}
                        style={[
                          styles.label,
                          {
                            color:
                              foregroundColor,
                            writingDirection,
                          },
                        ]}
                      >
                        {label}
                      </Animated.Text>
                    </Animated.View>
                  </View>
                );

                return (
                  <Pressable
                    key={route.key}
                    accessibilityRole="button"
                    accessibilityState={
                      focused
                        ? {
                            selected: true,
                          }
                        : {}
                    }
                    accessibilityLabel={
                      options
                        .tabBarAccessibilityLabel ??
                      label
                    }
                    testID={
                      options
                        .tabBarButtonTestID
                    }
                    onPress={handlePress}
                    onLongPress={
                      handleLongPress
                    }
                    style={styles.item}
                  >
                    {({ pressed }) => (
                      <Animated.View
                        style={[
                          styles.itemContent,
                          {
                            height:
                              itemHeight,
                            opacity: pressed
                              ? 0.88
                              : 1,
                            transform: [
                              {
                                scale:
                                  pressed
                                    ? 0.965
                                    : focused
                                      ? activeScale
                                      : 1,
                              },
                            ],
                          },
                        ]}
                      >
                        {focused ? (
                          <LinearGradient
                            colors={
                              palette
                                .tabActiveGradient
                            }
                            start={{
                              x: 0,
                              y: 0,
                            }}
                            end={{
                              x: 1,
                              y: 1,
                            }}
                            style={[
                              styles.activePill,
                              {
                                shadowOpacity:
                                  isDark
                                    ? 0.12
                                    : 0.08,
                                shadowRadius:
                                  isDark
                                    ? 8
                                    : 7,
                                elevation:
                                  isDark
                                    ? 5
                                    : 3,
                              },
                            ]}
                          >
                            <LinearGradient
                              pointerEvents="none"
                              colors={
                                activeGlossColors
                              }
                              start={{
                                x: 0,
                                y: 0,
                              }}
                              end={{
                                x: 0.8,
                                y: 1,
                              }}
                              style={
                                styles.activeGloss
                              }
                            />

                            {content}
                          </LinearGradient>
                        ) : (
                          <View
                            style={[
                              styles.inactivePill,
                              {
                                backgroundColor:
                                  pressed
                                    ? inactivePressedBackground
                                    : inactiveBackground,
                              },
                            ]}
                          >
                            {content}
                          </View>
                        )}
                      </Animated.View>
                    )}
                  </Pressable>
                );
              },
            )}
          </LinearGradient>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
    elevation: 40,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  shadowHost: {
    alignSelf: 'center',
    shadowOffset: {
      width: 0,
      height: 14,
    },
    shadowRadius: 18,
    elevation: Platform.OS === 'android'
      ? 22
      : 0,
  },
  frame: {
    flex: 1,
    borderRadius: 29,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  bar: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    padding: 5,
  },
  surfaceShield: {
    ...StyleSheet.absoluteFill,
  },
  gloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '62%',
  },
  innerEdge: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
  },
  item: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  itemContent: {
    alignSelf: 'stretch',
    overflow: 'visible',
  },
  activePill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor:
      'rgba(224,255,244,0.70)',
    overflow: 'hidden',
    shadowColor: '#38E3AE',
    shadowOffset: {
      width: 0,
      height: 5,
    },
  },
  activeGloss: {
    ...StyleSheet.absoluteFill,
  },
  inactivePill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  foreground: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    zIndex: 4,
    elevation: 4,
  },
  iconShell: {
    width: 35,
    height: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  labelShell: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  label: {
    width: '100%',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 11,
    lineHeight: 16,
    includeFontPadding: false,
  },
});
