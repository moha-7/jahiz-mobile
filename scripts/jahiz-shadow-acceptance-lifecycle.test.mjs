import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();

const acceptance = fs.readFileSync(
  path.join(
    repoRoot,
    'scripts',
    'jahiz-shadow-device-acceptance.ps1',
  ),
  'utf8',
);

const secureCursor = fs.readFileSync(
  path.join(
    repoRoot,
    'apps',
    'mobile',
    'src',
    'features',
    'sync',
    'jahiz-shadow-sync-secure-store.ts',
  ),
  'utf8',
);

test(
  'device acceptance harness preserves its dedicated Postgres database across restarts',
  () => {
    assert.doesNotMatch(
      acceptance,
      /DROP DATABASE/i,
    );

    assert.doesNotMatch(
      acceptance,
      /DROP ROLE/i,
    );

    assert.match(
      acceptance,
      /SELECT 1 FROM pg_roles/,
    );

    assert.match(
      acceptance,
      /ALTER ROLE \$TestRole WITH LOGIN PASSWORD/,
    );

    assert.match(
      acceptance,
      /SELECT 1 FROM pg_database/,
    );

    assert.match(
      acceptance,
      /ALTER DATABASE \$TestDb OWNER TO \$TestRole/,
    );

    assert.match(
      acceptance,
      /CREATE DATABASE \$TestDb OWNER \$TestRole/,
    );
  },
);

test(
  'device acceptance exports a stable cursor namespace',
  () => {
    assert.match(
      acceptance,
      /EXPO_PUBLIC_JAHIZ_SHADOW_CURSOR_NAMESPACE/,
    );

    assert.match(
      acceptance,
      /m7f2\.device\.acceptance\.v2/,
    );
  },
);

test(
  'native cursor SecureStore keys are always account-scoped and may add an environment namespace',
  () => {
    assert.match(
      secureCursor,
      /EXPO_PUBLIC_JAHIZ_SHADOW_CURSOR_NAMESPACE/,
    );

    assert.match(
      secureCursor,
      /\^\[A-Za-z0-9\._-\]\+\$/,
    );

    assert.match(
      secureCursor,
      /jahizLocalNamespaceStorageKey/,
    );

    assert.match(
      secureCursor,
      /\? `\$\{namespace\}\.\$\{accountScopedKey\}`\s*:\s*accountScopedKey/,
    );

    assert.doesNotMatch(
      secureCursor,
      /return createShadowSyncCursorStore\(\{\s*getItemAsync:\s*SecureStore\.getItemAsync/,
    );
  },
);
