import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const providers =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/providers/app-providers.tsx',
      import.meta.url,
    ),
    'utf8',
  );

const runtimeProvider =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/providers/jahiz-auth-runtime-provider.tsx',
      import.meta.url,
    ),
    'utf8',
  );

const appJson =
  JSON.parse(
    fs.readFileSync(
      new URL(
        '../apps/mobile/app.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );

const envExample =
  fs.readFileSync(
    new URL(
      '../.env.example',
      import.meta.url,
    ),
    'utf8',
  );

function pluginName(entry) {
  return Array.isArray(entry)
    ? entry[0]
    : entry;
}

test(
  'Jahiz auth runtime wraps existing provider composition',
  () => {
    const authOpen =
      providers.indexOf(
        '<JahizAuthRuntimeProvider>',
      );

    const themeOpen =
      providers.indexOf(
        '<JahizThemeProvider>',
      );

    assert.ok(authOpen >= 0);
    assert.ok(themeOpen > authOpen);

    assert.equal(
      (
        providers.match(
          /<JahizShadowSyncObserver \/>/g,
        ) ?? []
      ).length,
      1,
    );

    assert.equal(
      (
        providers.match(
          /<JahizShadowDiagnosticsOverlay \/>/g,
        ) ?? []
      ).length,
      1,
    );
  },
);

test(
  'runtime provider uses ClerkProvider and built-in SecureStore token cache',
  () => {
    assert.match(
      runtimeProvider,
      /ClerkProvider/,
    );

    assert.match(
      runtimeProvider,
      /@clerk\/expo\/token-cache/,
    );

    assert.match(
      runtimeProvider,
      /tokenCache=\{tokenCache\}/,
    );
  },
);

test(
  'runtime provider never reuses shadow development identity',
  () => {
    assert.doesNotMatch(
      runtimeProvider,
      /SHADOW_DEV_OWNER/,
    );

    assert.doesNotMatch(
      runtimeProvider,
      /Bearer dev:/,
    );
  },
);

test(
  'Expo config contains Clerk and SecureStore plugins',
  () => {
    const plugins =
      Array.isArray(
        appJson.expo?.plugins,
      )
        ? appJson.expo.plugins
        : [];

    const names =
      plugins.map(pluginName);

    assert.ok(
      names.includes(
        'expo-secure-store',
      ),
    );

    assert.ok(
      names.includes(
        '@clerk/expo',
      ),
    );
  },
);

test(
  'env example documents mode publishable key and API URL without a secret',
  () => {
    assert.match(
      envExample,
      /^EXPO_PUBLIC_JAHIZ_AUTH_MODE=/m,
    );

    assert.match(
      envExample,
      /^EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=/m,
    );

    assert.match(
      envExample,
      /^EXPO_PUBLIC_JAHIZ_API_URL=/m,
    );

    assert.doesNotMatch(
      envExample,
      /^EXPO_PUBLIC_.*CLERK_SECRET/m,
    );
  },
);
