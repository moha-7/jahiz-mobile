export type SecureStoreLike = {
  getItemAsync: (
    key: string,
  ) => Promise<string | null>;
  setItemAsync: (
    key: string,
    value: string,
  ) => Promise<void>;
  deleteItemAsync: (
    key: string,
  ) => Promise<void>;
};

type ChunkManifest = {
  version: 1;
  generation: string;
  chunks: number;
  bytes: number;
  checksum: string;
};

const CHUNK_BYTES = 1_500;
const MAX_CHUNKS = 512;
const SAFE_KEY_PATTERN =
  /^[A-Za-z0-9._-]+$/;

export function utf8ByteLength(
  value: string,
): number {
  let bytes = 0;

  for (const symbol of value) {
    const codePoint =
      symbol.codePointAt(0) ?? 0;

    if (codePoint <= 0x7f) {
      bytes += 1;
    } else if (
      codePoint <= 0x7ff
    ) {
      bytes += 2;
    } else if (
      codePoint <= 0xffff
    ) {
      bytes += 3;
    } else {
      bytes += 4;
    }
  }

  return bytes;
}

export function splitSecureValueIntoChunks(
  value: string,
  maxBytes = CHUNK_BYTES,
): string[] {
  if (
    !Number.isInteger(maxBytes) ||
    maxBytes < 256
  ) {
    throw new Error(
      'Secure chunk size must be an integer of at least 256 bytes.',
    );
  }

  if (value.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;

  for (const symbol of value) {
    const symbolBytes =
      utf8ByteLength(symbol);

    if (
      currentBytes > 0 &&
      currentBytes + symbolBytes >
        maxBytes
    ) {
      chunks.push(current);
      current = '';
      currentBytes = 0;
    }

    current += symbol;
    currentBytes +=
      symbolBytes;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  if (
    chunks.length >
    MAX_CHUNKS
  ) {
    throw new Error(
      'Persisted workspace is too large for secure chunk storage.',
    );
  }

  return chunks;
}

function checksum32(
  value: string,
): string {
  let hash = 0x811c9dc5;

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    hash ^=
      value.charCodeAt(index);

    hash =
      Math.imul(
        hash,
        0x01000193,
      );
  }

  return (
    hash >>> 0
  ).toString(36);
}

function assertSafeBaseKey(
  key: string,
) {
  if (
    !key ||
    !SAFE_KEY_PATTERN.test(key)
  ) {
    throw new Error(
      'Secure persistence key contains unsupported characters.',
    );
  }
}

function manifestKey(
  key: string,
): string {
  return `${key}.manifest`;
}

function chunkKey(
  key: string,
  generation: string,
  index: number,
): string {
  return [
    key,
    'chunk',
    generation,
    String(index),
  ].join('.');
}

function createGeneration(): string {
  return [
    Date.now().toString(36),
    Math.random()
      .toString(36)
      .slice(2, 10),
  ].join('-');
}

function parseManifest(
  raw: string | null,
): ChunkManifest | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed =
      JSON.parse(raw) as
        Partial<ChunkManifest>;

    if (
      parsed.version !== 1 ||
      typeof parsed.generation !==
        'string' ||
      !SAFE_KEY_PATTERN.test(
        parsed.generation,
      ) ||
      !Number.isInteger(
        parsed.chunks,
      ) ||
      Number(parsed.chunks) < 0 ||
      Number(parsed.chunks) >
        MAX_CHUNKS ||
      !Number.isInteger(
        parsed.bytes,
      ) ||
      Number(parsed.bytes) < 0 ||
      typeof parsed.checksum !==
        'string'
    ) {
      return null;
    }

    return {
      version: 1,
      generation:
        parsed.generation,
      chunks:
        Number(parsed.chunks),
      bytes:
        Number(parsed.bytes),
      checksum:
        parsed.checksum,
    };
  } catch {
    return null;
  }
}

async function readGeneration(
  secureStore: SecureStoreLike,
  key: string,
  manifest: ChunkManifest,
): Promise<string | null> {
  const pieces: string[] = [];

  for (
    let index = 0;
    index < manifest.chunks;
    index += 1
  ) {
    const piece =
      await secureStore.getItemAsync(
        chunkKey(
          key,
          manifest.generation,
          index,
        ),
      );

    if (piece === null) {
      return null;
    }

    pieces.push(piece);
  }

  const value =
    pieces.join('');

  if (
    utf8ByteLength(value) !==
      manifest.bytes ||
    checksum32(value) !==
      manifest.checksum
  ) {
    return null;
  }

  return value;
}

async function deleteGeneration(
  secureStore: SecureStoreLike,
  key: string,
  manifest: ChunkManifest,
) {
  for (
    let index = 0;
    index < manifest.chunks;
    index += 1
  ) {
    try {
      await secureStore.deleteItemAsync(
        chunkKey(
          key,
          manifest.generation,
          index,
        ),
      );
    } catch {
      // Cleanup is best-effort after the manifest has moved on.
    }
  }
}

export function createLargeValueSecureStoreAdapter(
  secureStore: SecureStoreLike,
) {
  return {
    async getItemAsync(
      key: string,
    ): Promise<string | null> {
      assertSafeBaseKey(key);

      const rawManifest =
        await secureStore.getItemAsync(
          manifestKey(key),
        );

      const manifest =
        parseManifest(
          rawManifest,
        );

      if (manifest) {
        const chunked =
          await readGeneration(
            secureStore,
            key,
            manifest,
          );

        if (chunked !== null) {
          return chunked;
        }
      }

      return secureStore.getItemAsync(
        key,
      );
    },

    async setItemAsync(
      key: string,
      value: string,
    ): Promise<void> {
      assertSafeBaseKey(key);

      const chunks =
        splitSecureValueIntoChunks(
          value,
        );

      const previousManifest =
        parseManifest(
          await secureStore.getItemAsync(
            manifestKey(key),
          ),
        );

      const generation =
        createGeneration();

      const writtenKeys:
        string[] = [];

      try {
        for (
          let index = 0;
          index < chunks.length;
          index += 1
        ) {
          const nextKey =
            chunkKey(
              key,
              generation,
              index,
            );

          await secureStore.setItemAsync(
            nextKey,
            chunks[index],
          );

          writtenKeys.push(
            nextKey,
          );
        }

        const manifest:
          ChunkManifest = {
            version: 1,
            generation,
            chunks:
              chunks.length,
            bytes:
              utf8ByteLength(
                value,
              ),
            checksum:
              checksum32(value),
          };

        await secureStore.setItemAsync(
          manifestKey(key),
          JSON.stringify(
            manifest,
          ),
        );
      } catch (error) {
        for (
          const writtenKey of
          writtenKeys
        ) {
          try {
            await secureStore.deleteItemAsync(
              writtenKey,
            );
          } catch {
            // Best-effort cleanup; old manifest remains authoritative.
          }
        }

        throw error;
      }

      try {
        await secureStore.deleteItemAsync(
          key,
        );
      } catch {
        // Legacy cleanup is best-effort after manifest commit.
      }

      if (previousManifest) {
        await deleteGeneration(
          secureStore,
          key,
          previousManifest,
        );
      }
    },

    async deleteItemAsync(
      key: string,
    ): Promise<void> {
      assertSafeBaseKey(key);

      const manifest =
        parseManifest(
          await secureStore.getItemAsync(
            manifestKey(key),
          ),
        );

      await secureStore.deleteItemAsync(
        manifestKey(key),
      );

      try {
        await secureStore.deleteItemAsync(
          key,
        );
      } catch {
        // Legacy value may not exist.
      }

      if (manifest) {
        await deleteGeneration(
          secureStore,
          key,
          manifest,
        );
      }
    },
  };
}
