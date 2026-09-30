import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveJahizMobileAuthRuntimeConfig,
} from '../apps/mobile/src/features/auth/jahiz-mobile-auth-runtime-config.ts';

test(
  'mobile auth defaults to development without credentials',
  () => {
    assert.deepEqual(
      resolveJahizMobileAuthRuntimeConfig({}),
      {
        mode: 'development',
      },
    );
  },
);

test(
  'explicit development mode does not require Clerk configuration',
  () => {
    assert.deepEqual(
      resolveJahizMobileAuthRuntimeConfig({
        mode: 'development',
      }),
      {
        mode: 'development',
      },
    );
  },
);

test(
  'Clerk mode requires publishable key and API URL',
  () => {
    assert.throws(() =>
      resolveJahizMobileAuthRuntimeConfig({
        mode: 'clerk',
      }),
    );

    assert.throws(() =>
      resolveJahizMobileAuthRuntimeConfig({
        mode: 'clerk',
        publishableKey:
          'pk_test_example',
      }),
    );
  },
);

test(
  'Clerk mode rejects secret keys in EXPO_PUBLIC configuration',
  () => {
    assert.throws(() =>
      resolveJahizMobileAuthRuntimeConfig({
        mode: 'clerk',
        publishableKey:
          'sk_test_never_public',
        apiUrl:
          'https://api.example.test',
      }),
    );
  },
);

test(
  'Clerk mode returns normalized safe runtime configuration',
  () => {
    assert.deepEqual(
      resolveJahizMobileAuthRuntimeConfig({
        mode: ' clerk ',
        publishableKey:
          ' pk_test_public ',
        apiUrl:
          'https://api.jahiz.test///',
      }),
      {
        mode: 'clerk',
        publishableKey:
          'pk_test_public',
        apiUrl:
          'https://api.jahiz.test',
      },
    );
  },
);

test(
  'unknown mode and invalid API URL fail closed',
  () => {
    assert.throws(() =>
      resolveJahizMobileAuthRuntimeConfig({
        mode: 'unknown',
      }),
    );

    assert.throws(() =>
      resolveJahizMobileAuthRuntimeConfig({
        mode: 'clerk',
        publishableKey:
          'pk_test_public',
        apiUrl: 'not-a-url',
      }),
    );
  },
);
