import assert from 'node:assert/strict';
import test from 'node:test';

import {
  tripWorkspaceSchema,
  type TripWorkspace,
} from '../packages/api-contracts/src/index.ts';

import {
  resolveShadowObserveConfig,
} from '../apps/mobile/src/features/sync/jahiz-shadow-sync-observe-config.ts';

import {
  createObserveOnlyShadowQueue,
} from '../apps/mobile/src/features/sync/jahiz-shadow-sync-observe-queue.ts';

function workspace(
  id: string,
  updatedAt: string,
): TripWorkspace {
  return tripWorkspaceSchema.parse({
    id,
    version: 1,
    currency: 'AED',
    route: null,
    dates: {
      departureDate: null,
      returnDate: null,
      flexibility: 'fixed',
    },
    profile: {
      travelStyle: 'smart',
      travelStyleConfirmed: true,
      purpose: 'leisure',
      travelers: {
        adults: 1,
        children: 0,
      },
    },
    funds: {
      availableNow: 5000,
      expectedBeforeTravel: 0,
      safetyReserve: 1000,
      originCommitments: 0,
    },
    costItems: [],
    payments: [],
    commitments: [],
    moneyIn: [],
    createdAt:
      '2026-08-24T07:00:00.000Z',
    updatedAt,
  });
}

test('observe mode is off unless the explicit flag is enabled', () => {
  assert.deepEqual(
    resolveShadowObserveConfig({
      isDevelopment: true,
      platform: 'ios',
      enabledFlag: undefined,
      baseUrl:
        'http://127.0.0.1:4010',
      devOwnerId: 'local-user',
    }),
    {
      enabled: false,
      reason: 'flag-off',
    },
  );
});

test('observe mode is blocked in production even when env is set', () => {
  assert.deepEqual(
    resolveShadowObserveConfig({
      isDevelopment: false,
      platform: 'ios',
      enabledFlag: '1',
      baseUrl:
        'https://example.invalid',
      devOwnerId: 'local-user',
    }),
    {
      enabled: false,
      reason: 'production',
    },
  );
});

test('observe mode is blocked on web because cursor storage is native SecureStore', () => {
  assert.deepEqual(
    resolveShadowObserveConfig({
      isDevelopment: true,
      platform: 'web',
      enabledFlag: '1',
      baseUrl:
        'http://127.0.0.1:4010',
      devOwnerId: 'local-user',
    }),
    {
      enabled: false,
      reason: 'web-disabled',
    },
  );
});

test('observe mode requires explicit API URL and development owner', () => {
  assert.deepEqual(
    resolveShadowObserveConfig({
      isDevelopment: true,
      platform: 'android',
      enabledFlag: '1',
      devOwnerId: 'local-user',
    }),
    {
      enabled: false,
      reason: 'missing-api-url',
    },
  );

  assert.deepEqual(
    resolveShadowObserveConfig({
      isDevelopment: true,
      platform: 'android',
      enabledFlag: '1',
      baseUrl:
        'http://10.0.2.2:4010',
    }),
    {
      enabled: false,
      reason:
        'missing-dev-owner',
    },
  );
});

test('enabled config trims URL and carries only non-secret development identity', () => {
  assert.deepEqual(
    resolveShadowObserveConfig({
      isDevelopment: true,
      platform: 'android',
      enabledFlag: '1',
      baseUrl:
        'http://10.0.2.2:4010/',
      devOwnerId:
        'local-device-a',
    }),
    {
      enabled: true,
      baseUrl:
        'http://10.0.2.2:4010',
      devOwnerId:
        'local-device-a',
    },
  );
});

test('observe queue debounces rapid local changes to the latest workspace', async () => {
  const synced:
    string[] = [];

  const queue =
    createObserveOnlyShadowQueue({
      debounceMs: 5,
      async sync(current) {
        synced.push(
          current.updatedAt,
        );
      },
    });

  queue.enqueue(
    workspace(
      'queue-trip',
      '2026-08-24T07:01:00.000Z',
    ),
  );

  queue.enqueue(
    workspace(
      'queue-trip',
      '2026-08-24T07:02:00.000Z',
    ),
  );

  await new Promise(
    (resolve) =>
      setTimeout(resolve, 20),
  );

  assert.deepEqual(
    synced,
    [
      '2026-08-24T07:02:00.000Z',
    ],
  );

  queue.stop();
});

test('observe queue preserves the latest trailing change while a sync is in flight', async () => {
  const synced:
    string[] = [];

  let releaseFirst:
    (() => void) | null = null;

  const firstGate =
    new Promise<void>(
      (resolve) => {
        releaseFirst = resolve;
      },
    );

  let call = 0;

  const queue =
    createObserveOnlyShadowQueue({
      debounceMs: 5,
      async sync(current) {
        call += 1;
        synced.push(
          current.updatedAt,
        );

        if (call === 1) {
          await firstGate;
        }
      },
    });

  queue.enqueue(
    workspace(
      'queue-trip',
      '2026-08-24T07:03:00.000Z',
    ),
  );

  await new Promise(
    (resolve) =>
      setTimeout(resolve, 10),
  );

  queue.enqueue(
    workspace(
      'queue-trip',
      '2026-08-24T07:04:00.000Z',
    ),
  );

  queue.enqueue(
    workspace(
      'queue-trip',
      '2026-08-24T07:05:00.000Z',
    ),
  );

  releaseFirst?.();

  await new Promise(
    (resolve) =>
      setTimeout(resolve, 20),
  );

  assert.deepEqual(
    synced,
    [
      '2026-08-24T07:03:00.000Z',
      '2026-08-24T07:05:00.000Z',
    ],
  );

  queue.stop();
});

test('stopped observe queue ignores future work', async () => {
  let calls = 0;

  const queue =
    createObserveOnlyShadowQueue({
      debounceMs: 1,
      async sync() {
        calls += 1;
      },
    });

  queue.stop();

  queue.enqueue(
    workspace(
      'queue-stop',
      '2026-08-24T07:06:00.000Z',
    ),
  );

  await new Promise(
    (resolve) =>
      setTimeout(resolve, 10),
  );

  assert.equal(
    calls,
    0,
  );
});
test('observe queue contains sync failures and continues with later work', async () => {
  const synced:
    string[] = [];
  const errors:
    string[] = [];

  let call = 0;

  const queue =
    createObserveOnlyShadowQueue({
      debounceMs: 1,
      async sync(current) {
        call += 1;

        if (call === 1) {
          throw new Error(
            'synthetic shadow failure',
          );
        }

        synced.push(
          current.updatedAt,
        );
      },
      onError(error) {
        errors.push(
          error instanceof Error
            ? error.message
            : String(error),
        );
      },
    });

  queue.enqueue(
    workspace(
      'queue-error',
      '2026-08-24T07:07:00.000Z',
    ),
  );

  await new Promise(
    (resolve) =>
      setTimeout(resolve, 10),
  );

  queue.enqueue(
    workspace(
      'queue-error',
      '2026-08-24T07:08:00.000Z',
    ),
  );

  await new Promise(
    (resolve) =>
      setTimeout(resolve, 10),
  );

  assert.deepEqual(
    errors,
    [
      'synthetic shadow failure',
    ],
  );

  assert.deepEqual(
    synced,
    [
      '2026-08-24T07:08:00.000Z',
    ],
  );

  queue.stop();
});
