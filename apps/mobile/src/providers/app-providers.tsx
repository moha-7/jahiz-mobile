import type { PropsWithChildren } from 'react';
import { useState } from 'react';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { TamaguiProvider } from 'tamagui';
import config from '../../tamagui.config';
import { JahizAuthRuntimeProvider } from './jahiz-auth-runtime-provider';
import { JahizPortfolioAdoptionBridge } from '@/features/auth/jahiz-portfolio-adoption-bridge';
import { LocaleProvider } from './locale-provider';
import { JahizThemeProvider } from './theme-provider';
import { JahizShadowSyncObserver } from '@/features/sync/jahiz-shadow-sync-observer';
import { JahizTripSyncRuntimeBridge } from '@/features/sync/jahiz-trip-sync-runtime-bridge';
import { JahizShadowDiagnosticsOverlay } from '@/features/sync/jahiz-shadow-diagnostics-overlay';
import { JahizProductMetricsObserver } from '@/features/product-metrics/jahiz-product-metrics-observer';
import { JahizProductMetricsDiagnosticsOverlay } from '@/features/product-metrics/jahiz-product-metrics-diagnostics-overlay';

export function AppProviders({
  children,
}: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <JahizAuthRuntimeProvider>
      <JahizThemeProvider>
      <TamaguiProvider
        config={config}
        defaultTheme="light"
      >
        <QueryClientProvider client={queryClient}>
          <LocaleProvider>
            <JahizPortfolioAdoptionBridge />
            <JahizShadowSyncObserver />
            <JahizTripSyncRuntimeBridge />
            <JahizProductMetricsObserver />
            <JahizShadowDiagnosticsOverlay />
            <JahizProductMetricsDiagnosticsOverlay />
            {children}
          </LocaleProvider>
        </QueryClientProvider>
      </TamaguiProvider>
    </JahizThemeProvider>
    </JahizAuthRuntimeProvider>
  );
}
