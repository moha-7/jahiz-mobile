import assert from 'node:assert/strict';
import test from 'node:test';

import {
  accountJahizLocalNamespace,
  anonymousJahizLocalNamespace,
  createJahizNamespacedStorage,
  jahizLocalNamespaceStorageKey,
  sameJahizLocalNamespace,
  type JahizStringStorage,
} from '../apps/mobile/src/features/local-persistence/jahiz-local-namespace.ts';

function createMemoryStorage() {
  const values =
    new Map<string, string>();

  const storage:
    JahizStringStorage = {
      getItem(key) {
        return values.get(key) ?? null;
      },
      setItem(
        key,
        value,
      ) {
        values.set(
          key,
          value,
        );
      },
      removeItem(key) {
        values.delete(key);
      },
    };

  return {
    storage,
    values,
  };
}

test(
  'account namespaces produce collision-free account-scoped keys',
  () => {
    const a =
      accountJahizLocalNamespace(
        'usr_account_a',
      );
    const b =
      accountJahizLocalNamespace(
        'usr_account_b',
      );

    assert.notEqual(
      jahizLocalNamespaceStorageKey(
        'jahiz.trip-portfolio.v2',
        a,
      ),
      jahizLocalNamespaceStorageKey(
        'jahiz.trip-portfolio.v2',
        b,
      ),
    );

    assert.equal(
      sameJahizLocalNamespace(
        a,
        accountJahizLocalNamespace(
          'usr_account_a',
        ),
      ),
      true,
    );
  },
);

test(
  'anonymous namespace never aliases an account namespace',
  () => {
    assert.notEqual(
      jahizLocalNamespaceStorageKey(
        'jahiz.trip-workspace.v1',
        anonymousJahizLocalNamespace(),
      ),
      jahizLocalNamespaceStorageKey(
        'jahiz.trip-workspace.v1',
        accountJahizLocalNamespace(
          'usr_account_a',
        ),
      ),
    );
  },
);

test(
  'namespaced storage isolates account A from account B without deleting either',
  async () => {
    const {
      storage,
      values,
    } = createMemoryStorage();

    let namespace =
      accountJahizLocalNamespace(
        'usr_account_a',
      );

    const namespaced =
      createJahizNamespacedStorage(
        storage,
        () => namespace,
      );

    await namespaced.setItem(
      'jahiz.trip-portfolio.v2',
      'A-sensitive-trip',
    );

    namespace =
      accountJahizLocalNamespace(
        'usr_account_b',
      );

    assert.equal(
      await namespaced.getItem(
        'jahiz.trip-portfolio.v2',
      ),
      null,
    );

    await namespaced.setItem(
      'jahiz.trip-portfolio.v2',
      'B-trip',
    );

    namespace =
      accountJahizLocalNamespace(
        'usr_account_a',
      );

    assert.equal(
      await namespaced.getItem(
        'jahiz.trip-portfolio.v2',
      ),
      'A-sensitive-trip',
    );

    assert.equal(
      values.size,
      2,
    );
  },
);

test(
  'unsafe owner ids fail closed instead of sharing a namespace',
  () => {
    assert.throws(
      () =>
        accountJahizLocalNamespace(
          'usr/a',
        ),
      /unsafe characters/,
    );
  },
);
