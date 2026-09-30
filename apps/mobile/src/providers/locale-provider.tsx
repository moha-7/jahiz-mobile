import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { getLocales } from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import type { SupportedLocale } from '@jahiz/config';
import { isRtlLocale, translate, type MessageKey } from '@jahiz/i18n';

interface LocaleContextValue {
  locale: SupportedLocale;
  isRtl: boolean;
  setLocale: (locale: SupportedLocale) => void;
  toggleLocale: () => void;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
}

const LOCALE_STORAGE_KEY = 'jahiz.locale';
const deviceLanguage = getLocales()[0]?.languageCode;
const initialLocale: SupportedLocale = deviceLanguage === 'ar' ? 'ar' : 'en';
const LocaleContext = createContext<LocaleContextValue | null>(null);

async function loadStoredLocale(): Promise<SupportedLocale | null> {
  try {
    if (Platform.OS === 'web') {
      const value = typeof localStorage === 'undefined' ? null : localStorage.getItem(LOCALE_STORAGE_KEY);
      return value === 'ar' || value === 'en' ? value : null;
    }

    const value = await SecureStore.getItemAsync(LOCALE_STORAGE_KEY);
    return value === 'ar' || value === 'en' ? value : null;
  } catch {
    return null;
  }
}

async function persistLocale(locale: SupportedLocale): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(LOCALE_STORAGE_KEY, locale);
      return;
    }

    await SecureStore.setItemAsync(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Locale persistence should never block the app shell.
  }
}

export function LocaleProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<SupportedLocale>(initialLocale);

  useEffect(() => {
    let active = true;
    void loadStoredLocale().then((storedLocale) => {
      if (active && storedLocale) setLocaleState(storedLocale);
    });
    return () => {
      active = false;
    };
  }, []);

  const setLocale = useCallback((nextLocale: SupportedLocale) => {
    setLocaleState(nextLocale);
    void persistLocale(nextLocale);
  }, []);

  const toggleLocale = useCallback(
    () => setLocale(locale === 'ar' ? 'en' : 'ar'),
    [locale, setLocale],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      isRtl: isRtlLocale(locale),
      setLocale,
      toggleLocale,
      t: (key, values) => translate(locale, key, values),
    }),
    [locale, setLocale, toggleLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useJahizLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('useJahizLocale must be used inside LocaleProvider.');
  return value;
}
