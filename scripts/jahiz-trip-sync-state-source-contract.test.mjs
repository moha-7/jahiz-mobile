import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const secureStore =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/sync/jahiz-trip-sync-state-secure-store.ts',
      import.meta.url,
    ),
    'utf8',
  );

const stateModel =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/sync/jahiz-trip-sync-state.ts',
      import.meta.url,
    ),
    'utf8',
  );

test(
  'durable sync state captures an explicit namespace instead of consulting a mutable account during persistence',
  () => {
    assert.match(
      secureStore,
      /namespace:\s*JahizLocalNamespace/,
    );

    assert.match(
      secureStore,
      /jahizLocalNamespaceStorageKey\(\s*key,\s*namespace,/,
    );
  },
);

test(
  'minimal sync state is not an ordered outbox',
  () => {
    assert.match(
      stateModel,
      /createPending/,
    );
    assert.match(
      stateModel,
      /workspaceMutation/,
    );
    assert.match(
      stateModel,
      /lifecycleMutation/,
    );

    assert.doesNotMatch(
      stateModel,
      /outbox|eventQueue|orderedEvents/i,
    );
  },
);

test(
  'conflict resolution model has no automatic retry or last-write-wins path',
  () => {
    assert.match(
      stateModel,
      /acceptJahizServerConflictVersion/,
    );

    assert.doesNotMatch(
      stateModel,
      /last-write-wins|autoMerge|retryOldSnapshot/i,
    );
  },
);
