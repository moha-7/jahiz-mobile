import type { PropsWithChildren } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react';
import {
  Animated,
} from 'react-native';

type TabBarMotionContextValue = {
  scrollY: Animated.Value;
  reset: () => void;
};

const TabBarMotionContext =
  createContext<TabBarMotionContextValue | null>(
    null,
  );

export function TabBarMotionProvider({
  children,
}: PropsWithChildren) {
  const scrollY = useRef(
    new Animated.Value(0),
  ).current;

  const reset = useCallback(() => {
    Animated.spring(scrollY, {
      toValue: 0,
      damping: 20,
      stiffness: 220,
      mass: 0.55,
      useNativeDriver: false,
    }).start();
  }, [scrollY]);

  const value = useMemo(
    () => ({
      scrollY,
      reset,
    }),
    [reset, scrollY],
  );

  return (
    <TabBarMotionContext.Provider value={value}>
      {children}
    </TabBarMotionContext.Provider>
  );
}

export function useTabBarMotion(): TabBarMotionContextValue {
  const value = useContext(TabBarMotionContext);
  const fallbackScrollY = useRef(
    new Animated.Value(0),
  ).current;

  const fallbackReset = useCallback(() => {
    fallbackScrollY.setValue(0);
  }, [fallbackScrollY]);

  return (
    value ?? {
      scrollY: fallbackScrollY,
      reset: fallbackReset,
    }
  );
}
