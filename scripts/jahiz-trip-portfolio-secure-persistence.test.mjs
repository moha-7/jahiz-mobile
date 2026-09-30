import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();

const portfolio = fs.readFileSync(
  path.join(
    repoRoot,
    'apps',
    'mobile',
    'src',
    'features',
    'trip-workspace',
    'trip-portfolio-store.ts',
  ),
  'utf8',
);

const adapter = fs.readFileSync(
  path.join(
    repoRoot,
    'apps',
    'mobile',
    'src',
    'features',
    'trip-workspace',
    'jahiz-secure-large-value-storage.ts',
  ),
  'utf8',
);

test(
  'native portfolio persistence uses shared large-value SecureStore adapter',
  () => {
    assert.match(
      portfolio,
      /createLargeValueSecureStoreAdapter/,
    );

    assert.match(
      portfolio,
      /nativePortfolioStorage\.getItemAsync\(/,
    );

    assert.match(
      portfolio,
      /nativePortfolioStorage\.setItemAsync\(/,
    );

    assert.match(
      portfolio,
      /nativePortfolioStorage\.deleteItemAsync\(/,
    );
  },
);

test(
  'portfolio contains no direct SecureStore persistence calls',
  () => {
    assert.doesNotMatch(
      portfolio,
      /(^|[^A-Za-z0-9_$])SecureStore\.getItemAsync\(/m,
    );

    assert.doesNotMatch(
      portfolio,
      /(^|[^A-Za-z0-9_$])SecureStore\.setItemAsync\(/m,
    );

    assert.doesNotMatch(
      portfolio,
      /(^|[^A-Za-z0-9_$])SecureStore\.deleteItemAsync\(/m,
    );
  },
);

test(
  'shared adapter keeps chunks below Expo SecureStore warning threshold',
  () => {
    assert.match(
      adapter,
      /const CHUNK_BYTES = 1_500;/,
    );

    assert.match(
      adapter,
      /manifestKey/,
    );

    assert.match(
      adapter,
      /previousManifest/,
    );
  },
);

test(
  'web portfolio persistence remains localStorage-backed',
  () => {
    assert.match(
      portfolio,
      /Platform\.OS === 'web'/,
    );

    assert.match(
      portfolio,
      /localStorage/,
    );
  },
);