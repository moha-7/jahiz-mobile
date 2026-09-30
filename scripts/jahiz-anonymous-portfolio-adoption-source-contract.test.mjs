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

const bridge =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/auth/jahiz-portfolio-adoption-bridge.tsx',
      import.meta.url,
    ),
    'utf8',
  );

const trips =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/trips/trips-screen.tsx',
      import.meta.url,
    ),
    'utf8',
  );

const adoption =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/auth/jahiz-local-portfolio-adoption.ts',
      import.meta.url,
    ),
    'utf8',
  );

const syncBridge =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/sync/jahiz-trip-sync-runtime-bridge.tsx',
      import.meta.url,
    ),
    'utf8',
  );

const adoptionUiStore =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/auth/jahiz-portfolio-adoption-ui-store.ts',
      import.meta.url,
    ),
    'utf8',
  );

test(
  'anonymous adoption inspection is mounted inside the authenticated provider tree',
  () => {
    assert.match(
      providers,
      /JahizPortfolioAdoptionBridge/,
    );

    assert.match(
      bridge,
      /accountResolution !==\s*'resolved'/,
    );

    assert.match(
      bridge,
      /localOwnerId !==\s*authenticatedOwnerId/,
    );
  },
);

test(
  'adoption is always explicit and divergence never auto-merges',
  () => {
    assert.match(
      trips,
      /anonymousAdoptionConfirm/,
    );

    assert.match(
      trips,
      /anonymousAdoptionKeepSeparate/,
    );

    assert.match(
      trips,
      /anonymousAdoptionMergeAction/,
    );

    assert.doesNotMatch(
      adoption,
      /autoMerge|last-write-wins/i,
    );

    assert.match(
      adoption,
      /allowAutomaticOverwrite:\s*false/,
    );
  },
);

test(
  'account copy is persisted before anonymous source is cleared',
  () => {
    const saveIndex =
      adoption.indexOf(
        'saveAccountPortfolio',
      );

    const clearIndex =
      adoption.lastIndexOf(
        'clearAnonymousPortfolio',
      );

    assert.ok(
      saveIndex >= 0 &&
      clearIndex > saveIndex,
    );
  },
);

test(
  'real authenticated sync fails closed until adoption preflight is explicitly clear',
  () => {
    assert.match(
      syncBridge,
      /adoptionGateStatus/,
    );

    assert.match(
      syncBridge,
      /adoptionGateStatus\s*!==\s*['"]clear['"]/,
    );

    assert.match(
      adoptionUiStore,
      /status:\s*['"]checking['"]/,
    );

    assert.match(
      adoptionUiStore,
      /markClear/,
    );
  },
);

test(
  'explicit adopt or keep-separate decisions release the sync gate without exposing internal checking state',
  () => {
    const markClearMatches =
      trips.match(
        /\.markClear\(/g,
      ) ?? [];

    assert.ok(
      markClearMatches.length >= 2,
    );

    assert.match(
      trips,
      /entry\?\.status ===\s*['"]offer-local-adoption['"]/,
    );

    assert.match(
      trips,
      /entry\?\.status ===\s*['"]merge-required['"]/,
    );
  },
);
