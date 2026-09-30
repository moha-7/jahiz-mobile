import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createLargeValueSecureStoreAdapter,
  splitSecureValueIntoChunks,
  utf8ByteLength,
} from '../apps/mobile/src/features/trip-workspace/jahiz-secure-large-value-storage.ts';

type MemorySecureStore = {
  values: Map<string, string>;
  failOnSet?: (
    key: string,
    value: string,
  ) => boolean;
};

function createMemorySecureStore(
  options:
    Partial<MemorySecureStore> = {},
) {
  const values =
    options.values ??
    new Map<string, string>();

  const writes:
    Array<{
      key: string;
      value: string;
    }> = [];

  return {
    values,
    writes,

    async getItemAsync(
      key: string,
    ) {
      return (
        values.get(key) ??
        null
      );
    },

    async setItemAsync(
      key: string,
      value: string,
    ) {
      assert.match(
        key,
        /^[A-Za-z0-9._-]+$/,
      );

      assert.ok(
        utf8ByteLength(value) <=
          2048,
        `SecureStore value exceeded 2048 bytes: ${utf8ByteLength(value)}`,
      );

      if (
        options.failOnSet?.(
          key,
          value,
        )
      ) {
        throw new Error(
          'synthetic secure write failure',
        );
      }

      writes.push({
        key,
        value,
      });

      values.set(
        key,
        value,
      );
    },

    async deleteItemAsync(
      key: string,
    ) {
      values.delete(key);
    },
  };
}

function largeWorkspaceJson(
  marker: string,
) {
  return JSON.stringify({
    state: {
      portfolio: {
        version: 2,
        marker,
        notes:
          'رحلة آمنة ✈️ '.repeat(
            1200,
          ),
        trips:
          Array.from(
            { length: 40 },
            (_, index) => ({
              id:
                `trip-${index}`,
              title:
                `DXB-${index}`,
              amount:
                1000 + index,
              notes:
                'hotel flight transport commitment '.repeat(
                  15,
                ),
            }),
          ),
      },
    },
    version: 2,
  });
}

test('UTF-8 chunking keeps every chunk safely below the native threshold', () => {
  const value =
    largeWorkspaceJson(
      'chunk-test',
    );

  const chunks =
    splitSecureValueIntoChunks(
      value,
    );

  assert.ok(
    chunks.length > 1,
  );

  assert.equal(
    chunks.join(''),
    value,
  );

  for (const chunk of chunks) {
    assert.ok(
      utf8ByteLength(chunk) <=
        1500,
    );
  }
});

test('large workspace round-trips through a SecureStore implementation that rejects oversized values', async () => {
  const secure =
    createMemorySecureStore();

  const adapter =
    createLargeValueSecureStoreAdapter(
      secure,
    );

  const value =
    largeWorkspaceJson(
      'round-trip',
    );

  await adapter.setItemAsync(
    'jahiz.trip-portfolio.v2',
    value,
  );

  assert.equal(
    await adapter.getItemAsync(
      'jahiz.trip-portfolio.v2',
    ),
    value,
  );

  assert.equal(
    secure.values.has(
      'jahiz.trip-portfolio.v2',
    ),
    false,
  );

  assert.ok(
    secure.values.has(
      'jahiz.trip-portfolio.v2.manifest',
    ),
  );
});

test('legacy single-value persistence remains readable before first chunked rewrite', async () => {
  const secure =
    createMemorySecureStore();

  const legacy =
    '{"state":{"legacy":true}}';

  secure.values.set(
    'jahiz.trip-workspace.v1',
    legacy,
  );

  const adapter =
    createLargeValueSecureStoreAdapter(
      secure,
    );

  assert.equal(
    await adapter.getItemAsync(
      'jahiz.trip-workspace.v1',
    ),
    legacy,
  );
});

test('a failed new generation preserves the previous committed generation', async () => {
  const secure =
    createMemorySecureStore();

  const adapter =
    createLargeValueSecureStoreAdapter(
      secure,
    );

  const original =
    largeWorkspaceJson(
      'original',
    );

  await adapter.setItemAsync(
    'jahiz.trip-portfolio.v2',
    original,
  );

  let failed = false;

  const failingSecure =
    createMemorySecureStore({
      values:
        secure.values,
      failOnSet(
        key,
      ) {
        if (
          !failed &&
          key.includes(
            '.chunk.',
          )
        ) {
          failed = true;
          return true;
        }

        return false;
      },
    });

  const failingAdapter =
    createLargeValueSecureStoreAdapter(
      failingSecure,
    );

  await assert.rejects(
    () =>
      failingAdapter.setItemAsync(
        'jahiz.trip-portfolio.v2',
        largeWorkspaceJson(
          'replacement',
        ),
      ),
    /synthetic secure write failure/,
  );

  assert.equal(
    await adapter.getItemAsync(
      'jahiz.trip-portfolio.v2',
    ),
    original,
  );
});

test('delete removes the manifest and committed chunk generation', async () => {
  const secure =
    createMemorySecureStore();

  const adapter =
    createLargeValueSecureStoreAdapter(
      secure,
    );

  await adapter.setItemAsync(
    'jahiz.trip-portfolio.v2',
    largeWorkspaceJson(
      'delete-me',
    ),
  );

  await adapter.deleteItemAsync(
    'jahiz.trip-portfolio.v2',
  );

  assert.equal(
    await adapter.getItemAsync(
      'jahiz.trip-portfolio.v2',
    ),
    null,
  );

  assert.equal(
    Array.from(
      secure.values.keys(),
    ).some(
      (key) =>
        key.startsWith(
          'jahiz.trip-portfolio.v2.chunk.',
        ),
    ),
    false,
  );
});

test('different storage names remain isolated', async () => {
  const secure =
    createMemorySecureStore();

  const adapter =
    createLargeValueSecureStoreAdapter(
      secure,
    );

  await adapter.setItemAsync(
    'jahiz.trip-portfolio.v2',
    largeWorkspaceJson(
      'portfolio-a',
    ),
  );

  await adapter.setItemAsync(
    'jahiz.trip-workspace.v1',
    largeWorkspaceJson(
      'workspace-b',
    ),
  );

  assert.match(
    (
      await adapter.getItemAsync(
        'jahiz.trip-portfolio.v2',
      )
    ) ?? '',
    /portfolio-a/,
  );

  assert.match(
    (
      await adapter.getItemAsync(
        'jahiz.trip-workspace.v1',
      )
    ) ?? '',
    /workspace-b/,
  );
});
