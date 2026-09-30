import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveJahizSyncRuntimeConfig,
} from '../apps/mobile/src/features/sync/jahiz-sync-runtime-config.ts';

import {
  createJahizSyncRuntimeController,
} from '../apps/mobile/src/features/sync/jahiz-sync-runtime-controller.ts';

import {
  createEmptyJahizTripSyncState,
} from '../apps/mobile/src/features/sync/jahiz-trip-sync-state.ts';

import {
  tripWorkspaceSchema,
} from '../packages/api-contracts/src/index.ts';

function workspace(
  id: string,
  availableNow: number,
) {
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
      availableNow,
      expectedBeforeTravel: 0,
      safetyReserve: 0,
      originCommitments: 0,
    },
    costItems: [],
    payments: [],
    commitments: [],
    moneyIn: [],
    createdAt:
      '2026-09-02T07:00:00.000Z',
    updatedAt:
      '2026-09-02T07:01:00.000Z',
  });
}

test(
  'real sync runtime is disabled unless explicitly enabled',
  () => {
    assert.deepEqual(
      resolveJahizSyncRuntimeConfig({
        platform: 'ios',
        apiUrl:
          'https://api.example.com',
      }),
      {
        enabled: false,
        reason: 'not-enabled',
      },
    );
  },
);

test(
  'kill switch overrides explicit sync enable',
  () => {
    assert.deepEqual(
      resolveJahizSyncRuntimeConfig({
        platform: 'android',
        enabledFlag: 'true',
        killSwitchFlag: 'true',
        apiUrl:
          'https://api.example.com',
      }),
      {
        enabled: false,
        reason: 'killed',
      },
    );
  },
);

test(
  'web sync requires a separate explicit allow flag',
  () => {
    assert.deepEqual(
      resolveJahizSyncRuntimeConfig({
        platform: 'web',
        enabledFlag: 'true',
        apiUrl:
          'https://api.example.com',
      }),
      {
        enabled: false,
        reason:
          'web-not-allowed',
      },
    );

    assert.deepEqual(
      resolveJahizSyncRuntimeConfig({
        platform: 'web',
        enabledFlag: 'true',
        allowWebFlag: 'true',
        apiUrl:
          'https://api.example.com',
      }),
      {
        enabled: true,
        apiUrl:
          'https://api.example.com',
      },
    );
  },
);

test(
  'sync runtime requires a concrete API URL even when enabled',
  () => {
    assert.deepEqual(
      resolveJahizSyncRuntimeConfig({
        platform: 'ios',
        enabledFlag: 'true',
      }),
      {
        enabled: false,
        reason:
          'missing-api-url',
      },
    );
  },
);

test(
  'runtime controller coalesces queued edits for the same trip before sending',
  async () => {
    const callbacks:
      Array<() => void> = [];

    const synced:
      number[] = [];

    const controller =
      createJahizSyncRuntimeController({
        executor: {
          async syncTrip(input) {
            synced.push(
              input.workspace.funds
                .availableNow ?? 0,
            );

            return {
              outcome:
                'synced' as const,
              state:
                createEmptyJahizTripSyncState(
                  input.workspace.id,
                ),
              operations: [],
              remoteTrip: null,
            };
          },
        },
        schedule(callback) {
          callbacks.push(
            callback,
          );

          return (
            callbacks.length as unknown
          ) as ReturnType<
            typeof setTimeout
          >;
        },
        cancel() {
          // The latest scheduled callback is replaced logically by enqueue.
        },
      });

    controller.enqueue({
      workspace:
        workspace(
          'runtime-coalesce',
          1000,
        ),
      desiredLifecycle:
        'active',
    });

    controller.enqueue({
      workspace:
        workspace(
          'runtime-coalesce',
          2000,
        ),
      desiredLifecycle:
        'active',
    });

    callbacks.at(-1)?.();

    await new Promise(
      (resolve) =>
        setTimeout(resolve, 0),
    );

    assert.deepEqual(
      synced,
      [2000],
    );
  },
);

test(
  'runtime controller stop prevents queued work from starting',
  async () => {
    const callbacks:
      Array<() => void> = [];

    let syncCalls = 0;

    const controller =
      createJahizSyncRuntimeController({
        executor: {
          async syncTrip(input) {
            syncCalls += 1;

            return {
              outcome:
                'synced' as const,
              state:
                createEmptyJahizTripSyncState(
                  input.workspace.id,
                ),
              operations: [],
              remoteTrip: null,
            };
          },
        },
        schedule(callback) {
          callbacks.push(
            callback,
          );

          return (
            callbacks.length as unknown
          ) as ReturnType<
            typeof setTimeout
          >;
        },
        cancel() {},
      });

    controller.enqueue({
      workspace:
        workspace(
          'runtime-stop',
          1000,
        ),
      desiredLifecycle:
        'active',
    });

    controller.stop();

    callbacks.at(-1)?.();

    await new Promise(
      (resolve) =>
        setTimeout(resolve, 0),
    );

    assert.equal(
      syncCalls,
      0,
    );
  },
);
