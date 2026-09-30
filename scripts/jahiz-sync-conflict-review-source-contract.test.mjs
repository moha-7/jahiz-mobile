import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(path) {
  return fs.readFileSync(
    new URL(
      `../${path}`,
      import.meta.url,
    ),
    'utf8',
  );
}

const tripsScreen =
  read(
    'apps/mobile/src/features/trips/trips-screen.tsx',
  );

const runtimeBridge =
  read(
    'apps/mobile/src/features/sync/jahiz-trip-sync-runtime-bridge.tsx',
  );

const conflictState =
  read(
    'apps/mobile/src/features/sync/jahiz-trip-sync-state.ts',
  );

test(
  'conflict UX exposes only explicit server, preserve-local, or decide-later choices',
  () => {
    assert.match(
      tripsScreen,
      /syncUseServerVersion/,
    );
    assert.match(
      tripsScreen,
      /syncPreserveLocalDraft/,
    );
    assert.match(
      tripsScreen,
      /syncDecideLater/,
    );

    assert.doesNotMatch(
      tripsScreen,
      /auto.?merge|last.?write.?wins|retry.*snapshot/i,
    );
  },
);

test(
  'review metadata hydrates for the authenticated owner even when real sync is disabled',
  () => {
    assert.match(
      runtimeBridge,
      /if \(!config\.enabled\)/,
    );
    assert.match(
      runtimeBridge,
      /stateStore/,
    );
    assert.match(
      runtimeBridge,
      /loadAll\(\)/,
    );
    assert.match(
      runtimeBridge,
      /replaceOwnerReviews/,
    );
  },
);

test(
  'preserved review remains separate from active conflict and canonical pending mutations',
  () => {
    assert.match(
      conflictState,
      /preservedReview/,
    );
    assert.match(
      conflictState,
      /preserveJahizConflictDraftForReview/,
    );
    assert.match(
      conflictState,
      /lastSyncedLocalUpdatedAt:\s*remoteTrip\.workspace\.updatedAt/,
    );
  },
);
