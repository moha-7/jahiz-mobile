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

const bridge =
  read(
    'apps/mobile/src/features/sync/jahiz-trip-sync-runtime-bridge.tsx',
  );

const providers =
  read(
    'apps/mobile/src/providers/app-providers.tsx',
  );

const auth =
  read(
    'apps/mobile/src/providers/jahiz-auth-runtime-provider.tsx',
  );

const observer =
  read(
    'apps/mobile/src/features/sync/jahiz-shadow-sync-observer.tsx',
  );

test(
  'real sync runtime is mounted but guarded by explicit enable and kill-switch flags',
  () => {
    assert.match(
      providers,
      /JahizTripSyncRuntimeBridge/,
    );

    assert.match(
      bridge,
      /EXPO_PUBLIC_JAHIZ_SYNC_ENABLED/,
    );

    assert.match(
      bridge,
      /EXPO_PUBLIC_JAHIZ_SYNC_KILL_SWITCH/,
    );
  },
);

test(
  'real sync requires a resolved authenticated owner and never runs on local fallback alone',
  () => {
    assert.match(
      bridge,
      /accountResolution !==\s*'resolved'/,
    );

    assert.match(
      bridge,
      /localOwnerId !==\s*authenticatedOwnerId/,
    );

    assert.match(
      bridge,
      /state\.status ===\s*'authenticated'/,
    );
  },
);

test(
  'runtime uses Clerk authorization from auth bridge instead of a dev owner bearer',
  () => {
    assert.match(
      auth,
      /getAuthorizationHeader/,
    );

    assert.match(
      bridge,
      /getAuthorizationHeader/,
    );

    assert.doesNotMatch(
      bridge,
      /Bearer dev:/,
    );
  },
);

test(
  'runtime syncs canonical TripPortfolio records and derives only local active or archived lifecycle',
  () => {
    assert.match(
      bridge,
      /useTripPortfolioStore/,
    );

    assert.match(
      bridge,
      /portfolio\.trips/,
    );

    assert.match(
      bridge,
      /record\.archivedAt\s*\?\s*'archived'\s*:\s*'active'/,
    );
  },
);

test(
  'real sync and development shadow observer are mutually exclusive writers',
  () => {
    assert.match(
      observer,
      /authoritySyncConfig\.enabled/,
    );

    assert.match(
      observer,
      /!config\.enabled\s*\|\|\s*authoritySyncConfig\.enabled/,
    );
  },
);
