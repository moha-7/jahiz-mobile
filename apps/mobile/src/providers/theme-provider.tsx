import type { PropsWithChildren } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Platform,
  useColorScheme,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type JahizThemePreference =
  | 'system'
  | 'light'
  | 'dark';

export type JahizResolvedTheme = 'light' | 'dark';

export type JahizThemePalette = {
  background: string;
  backgroundElevated: string;
  surface: string;
  surfaceMuted: string;
  surfaceStrong: string;
  inputBackground: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  heroText: string;
  heroSecondary: string;
  heroGradient: readonly [string, string, string];
  tabBackground: string;
  tabBorder: string;
  tabInactive: string;
  tabActiveGradient: readonly [string, string, string];
  premiumCardText: string;
  premiumCardSecondary: string;
  darkCardGradient: readonly [string, string, string];
  surfaceGradient: readonly [string, string];
  mintGradient: readonly [string, string];
  skyGradient: readonly [string, string];
  amberGradient: readonly [string, string];
  glassHighlight: string;
  successSurface: string;
  infoSurface: string;
  warningSurface: string;
  dangerSurface: string;
};

type ThemeContextValue = {
  preference: JahizThemePreference;
  resolvedTheme: JahizResolvedTheme;
  isDark: boolean;
  palette: JahizThemePalette;
  setThemePreference: (
    preference: JahizThemePreference,
  ) => void;
};

const THEME_STORAGE_KEY = 'jahiz.theme.preference';

const lightPalette: JahizThemePalette = {
  background: '#F1F4F8',
  backgroundElevated: '#E9EFF5',
  surface: '#FFFFFF',
  surfaceMuted: '#F2F6FA',
  surfaceStrong: '#E5ECF3',
  inputBackground: '#F6F8FB',
  textPrimary: '#0F172A',
  textSecondary: '#465B72',
  textMuted: '#6E8093',
  border: '#CBD6E2',
  borderStrong: '#AEBCCB',
  heroText: '#0D2238',
  heroSecondary: '#58708A',
  heroGradient: [
    '#FAFDFF',
    '#EEF7FB',
    '#E3F7EF',
  ],
  tabBackground: 'transparent',
  tabBorder: 'rgba(71,92,113,0.34)',
  tabInactive: '#536A80',
  tabActiveGradient: [
    'rgba(121,240,190,0.96)',
    'rgba(45,215,164,0.94)',
    'rgba(35,201,176,0.92)',
  ],
  premiumCardText: '#FFFFFF',
  premiumCardSecondary: '#B8C8D8',
  darkCardGradient: [
    'rgba(17,35,60,0.98)',
    'rgba(18,51,74,0.98)',
    'rgba(12,59,59,0.98)',
  ],
  surfaceGradient: [
    'rgba(255,255,255,0.99)',
    'rgba(243,247,251,0.98)',
  ],
  mintGradient: [
    'rgba(243,255,249,0.99)',
    'rgba(220,246,234,0.98)',
  ],
  skyGradient: [
    'rgba(245,252,255,0.99)',
    'rgba(221,239,249,0.98)',
  ],
  amberGradient: [
    'rgba(255,251,243,0.99)',
    'rgba(249,234,201,0.98)',
  ],
  glassHighlight: 'rgba(255,255,255,0.92)',
  successSurface: '#E9FAF3',
  infoSurface: '#EDF8FE',
  warningSurface: '#FFF6E2',
  dangerSurface: '#FFF1F1',
};

const darkPalette: JahizThemePalette = {
  background: '#0B111A',
  backgroundElevated: '#101824',
  surface: '#141E2B',
  surfaceMuted: '#182432',
  surfaceStrong: '#1E2D3D',
  inputBackground: '#121C28',
  textPrimary: '#F2F5F8',
  textSecondary: '#AFBAC7',
  textMuted: '#7F8C9B',
  border: 'rgba(177,190,204,0.12)',
  borderStrong: 'rgba(177,190,204,0.22)',
  heroText: '#F7F9FB',
  heroSecondary: '#A8B3C1',
  heroGradient: [
    '#0B111A',
    '#101A26',
    '#12232A',
  ],
  tabBackground: 'transparent',
  tabBorder: 'rgba(210,224,237,0.20)',
  tabInactive: '#D8E2EC',
  tabActiveGradient: [
    'rgba(111,226,184,0.88)',
    'rgba(38,190,146,0.84)',
    'rgba(28,151,126,0.82)',
  ],
  premiumCardText: '#F7F9FB',
  premiumCardSecondary: '#AEB9C7',
  darkCardGradient: [
    'rgba(24,35,48,0.99)',
    'rgba(20,31,44,0.99)',
    'rgba(17,28,40,0.99)',
  ],
  surfaceGradient: [
    'rgba(24,35,48,0.99)',
    'rgba(17,27,39,0.99)',
  ],
  mintGradient: [
    'rgba(20,44,41,0.99)',
    'rgba(17,34,34,0.99)',
  ],
  skyGradient: [
    'rgba(20,39,54,0.99)',
    'rgba(17,31,44,0.99)',
  ],
  amberGradient: [
    'rgba(48,40,25,0.99)',
    'rgba(34,29,22,0.99)',
  ],
  glassHighlight: 'rgba(255,255,255,0.10)',
  successSurface: 'rgba(45,190,137,0.10)',
  infoSurface: 'rgba(74,163,213,0.10)',
  warningSurface: 'rgba(222,157,53,0.11)',
  dangerSurface: 'rgba(226,79,79,0.10)',
};

const ThemeContext =
  createContext<ThemeContextValue | null>(null);

function isThemePreference(
  value: string | null,
): value is JahizThemePreference {
  return (
    value === 'system' ||
    value === 'light' ||
    value === 'dark'
  );
}

async function loadStoredPreference(): Promise<JahizThemePreference | null> {
  try {
    if (Platform.OS === 'web') {
      const value =
        globalThis.localStorage?.getItem(
          THEME_STORAGE_KEY,
        ) ?? null;

      return isThemePreference(value) ? value : null;
    }

    const value = await SecureStore.getItemAsync(
      THEME_STORAGE_KEY,
    );

    return isThemePreference(value) ? value : null;
  } catch {
    return null;
  }
}

async function persistPreference(
  preference: JahizThemePreference,
): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(
        THEME_STORAGE_KEY,
        preference,
      );
      return;
    }

    await SecureStore.setItemAsync(
      THEME_STORAGE_KEY,
      preference,
    );
  } catch {
    // The in-memory preference still remains active.
  }
}

export function JahizThemeProvider({
  children,
}: PropsWithChildren) {
  const systemTheme = useColorScheme();
  const [preference, setPreference] =
    useState<JahizThemePreference>('system');

  useEffect(() => {
    let active = true;

    void loadStoredPreference().then((stored) => {
      if (active && stored) {
        setPreference(stored);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const setThemePreference = useCallback(
    (nextPreference: JahizThemePreference) => {
      setPreference(nextPreference);
      void persistPreference(nextPreference);
    },
    [],
  );

  const resolvedTheme: JahizResolvedTheme =
    preference === 'system'
      ? systemTheme === 'dark'
        ? 'dark'
        : 'light'
      : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolvedTheme,
      isDark: resolvedTheme === 'dark',
      palette:
        resolvedTheme === 'dark'
          ? darkPalette
          : lightPalette,
      setThemePreference,
    }),
    [
      preference,
      resolvedTheme,
      setThemePreference,
    ],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useJahizTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error(
      'useJahizTheme must be used inside JahizThemeProvider.',
    );
  }

  return value;
}
