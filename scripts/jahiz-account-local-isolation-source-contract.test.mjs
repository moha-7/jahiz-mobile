import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(relativePath) {
  return fs.readFileSync(
    new URL(
      `../${relativePath}`,
      import.meta.url,
    ),
    'utf8',
  );
}

const authRuntime =
  read(
    'apps/mobile/src/providers/jahiz-auth-runtime-provider.tsx',
  );

const rootLayout =
  read(
    'apps/mobile/src/app/_layout.tsx',
  );

const portfolioStore =
  read(
    'apps/mobile/src/features/trip-workspace/trip-portfolio-store.ts',
  );

const workspaceStore =
  read(
    'apps/mobile/src/features/trip-workspace/trip-workspace-store.ts',
  );

const cursorStore =
  read(
    'apps/mobile/src/features/sync/jahiz-shadow-sync-secure-store.ts',
  );

const localPlatform =
  read(
    'apps/mobile/src/features/local-persistence/jahiz-local-persistence-platform.ts',
  );

test(
  'trip persistence and cursors are wired through account-scoped local namespace keys',
  () => {
    assert.match(
      portfolioStore,
      /jahizLocalNamespaceStorageKey/,
    );
    assert.match(
      workspaceStore,
      /jahizLocalNamespaceStorageKey/,
    );
    assert.match(
      cursorStore,
      /jahizLocalNamespaceStorageKey/,
    );
  },
);

test(
  'normal logout detaches the active namespace without deleting account persistence',
  () => {
    const signOutStart =
      authRuntime.indexOf(
        'const signOut =',
      );
    const valueStart =
      authRuntime.indexOf(
        'const value =',
        signOutStart,
      );

    assert.ok(signOutStart >= 0);
    assert.ok(valueStart > signOutStart);

    const signOutBlock =
      authRuntime.slice(
        signOutStart,
        valueStart,
      );

    assert.match(
      signOutBlock,
      /switchTripLocalNamespace/,
    );
    assert.match(
      signOutBlock,
      /anonymousJahizLocalNamespace/,
    );

    assert.doesNotMatch(
      signOutBlock,
      /resetPortfolio|resetWorkspace|clearStorage|deleteItemAsync/,
    );
  },
);

test(
  'offline local fallback requires both server unavailability and a verified cached owner binding',
  () => {
    assert.match(
      rootLayout,
      /accountResolution ===\s*'unavailable'/,
    );
    assert.match(
      rootLayout,
      /localOwnerId !== null/,
    );
    assert.match(
      rootLayout,
      /!canUseLocalFallback/,
    );

    assert.match(
      authRuntime,
      /loadVerifiedLocalOwnerId/,
    );
    assert.match(
      authRuntime,
      /saveVerifiedLocalAccountBinding/,
    );

    assert.match(
      authRuntime,
      /provider-mismatch/,
    );
  },
);

test(
  'legacy global trip persistence is reset rather than adopted by the first account',
  () => {
    assert.match(
      localPlatform,
      /TRIP_PORTFOLIO_STORAGE_KEY/,
    );
    assert.match(
      localPlatform,
      /TRIP_WORKSPACE_STORAGE_KEY/,
    );
    assert.match(
      localPlatform,
      /LOCAL_NAMESPACE_MIGRATION_MARKER_KEY/,
    );

    assert.doesNotMatch(
      localPlatform,
      /first account|adopt.*legacy|legacy.*ownerId/i,
    );
  },
);

test(
  'TripPortfolio is explicitly the canonical persisted collection on namespace switch',
  () => {
    assert.match(
      workspaceStore,
      /TripPortfolio is the canonical persisted local collection/,
    );
    assert.match(
      workspaceStore,
      /persist\.rehydrate\(\)/,
    );
    assert.match(
      workspaceStore,
      /workspace: activeWorkspace/,
    );
  },
);
