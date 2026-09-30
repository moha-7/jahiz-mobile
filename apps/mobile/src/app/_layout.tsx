import {
  Redirect,
  Stack,
  useSegments,
} from 'expo-router';
import {
  ActivityIndicator,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AppProviders } from '@/providers/app-providers';
import {
  useJahizAuthRuntime,
} from '@/providers/jahiz-auth-runtime-provider';
import { useJahizTheme } from '@/providers/theme-provider';

function RootNavigator() {
  const {
    isDark,
    palette,
  } = useJahizTheme();

  const {
    mode,
    state,
    accountResolution,
    localOwnerId,
  } = useJahizAuthRuntime();

  const segments = useSegments();

  const isAuthRoute =
    segments[0] === '(auth)';

  const canUseLocalFallback =
    mode === 'clerk' &&
    state.status === 'loading' &&
    accountResolution ===
      'unavailable' &&
    localOwnerId !== null;

  const isBlockingAuthResolution =
    mode === 'clerk' &&
    state.status === 'loading' &&
    !canUseLocalFallback;

  if (isBlockingAuthResolution) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor:
            palette.background,
        }}
      >
        <StatusBar
          style={
            isDark
              ? 'light'
              : 'dark'
          }
        />

        <ActivityIndicator
          size="small"
          color="#2DD7A4"
        />
      </View>
    );
  }

  if (
    mode !== 'clerk' &&
    isAuthRoute
  ) {
    return (
      <Redirect
        href="/(tabs)"
      />
    );
  }

  if (
    mode === 'clerk' &&
    state.status === 'anonymous' &&
    !isAuthRoute
  ) {
    return (
      <Redirect
        href="/(auth)/sign-in"
      />
    );
  }

  if (
    mode === 'clerk' &&
    (
      state.status ===
        'authenticated' ||
      canUseLocalFallback
    ) &&
    isAuthRoute
  ) {
    return (
      <Redirect
        href="/(tabs)"
      />
    );
  }

  return (
    <>
      <StatusBar
        style={
          isDark
            ? 'light'
            : 'dark'
        }
      />

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor:
              palette.background,
          },
        }}
      >
        <Stack.Screen
          name="(auth)"
        />

        <Stack.Screen
          name="(tabs)"
        />

        <Stack.Screen
          name="trip/create/route"
          options={{
            presentation: 'card',
          }}
        />

        <Stack.Screen
          name="trip/create/dates"
          options={{
            presentation: 'card',
          }}
        />

        <Stack.Screen
          name="trip/create/funds"
          options={{
            presentation: 'card',
          }}
        />

        <Stack.Screen
          name="trip/create/commitments"
          options={{
            presentation: 'card',
          }}
        />

        <Stack.Screen
          name="trip/create/costs"
          options={{
            presentation: 'card',
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}