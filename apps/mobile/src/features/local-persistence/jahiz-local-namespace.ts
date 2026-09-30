export const TRIP_PORTFOLIO_STORAGE_KEY =
  'jahiz.trip-portfolio.v2';

export const TRIP_WORKSPACE_STORAGE_KEY =
  'jahiz.trip-workspace.v1';

export const LOCAL_NAMESPACE_MIGRATION_MARKER_KEY =
  'jahiz.local-namespace-migration.v1';

export const LOCAL_ACCOUNT_BINDINGS_STORAGE_KEY =
  'jahiz.local-account-bindings.v1';

const LOCAL_NAMESPACE_STORAGE_PREFIX =
  'jahiz.local.v1';

const SAFE_STORAGE_KEY_PATTERN =
  /^[A-Za-z0-9._-]+$/;

export type JahizLocalNamespace =
  | {
      kind: 'anonymous';
    }
  | {
      kind: 'account';
      ownerId: string;
    };

export type JahizStringStorage = {
  getItem: (
    key: string,
  ) =>
    | string
    | null
    | Promise<string | null>;
  setItem: (
    key: string,
    value: string,
  ) => void | Promise<void>;
  removeItem: (
    key: string,
  ) => void | Promise<void>;
};

let activeNamespace:
  JahizLocalNamespace = {
    kind: 'anonymous',
  };

let namespaceGeneration = 0;
let namespaceTransitionDepth = 0;

export function anonymousJahizLocalNamespace():
  JahizLocalNamespace {
  return {
    kind: 'anonymous',
  };
}

export function accountJahizLocalNamespace(
  ownerId: string,
): JahizLocalNamespace {
  const normalized =
    ownerId.trim();

  if (
    !normalized ||
    !SAFE_STORAGE_KEY_PATTERN.test(
      normalized,
    )
  ) {
    throw new Error(
      'Jahiz local owner id contains unsafe characters.',
    );
  }

  return {
    kind: 'account',
    ownerId: normalized,
  };
}

export function sameJahizLocalNamespace(
  left: JahizLocalNamespace,
  right: JahizLocalNamespace,
): boolean {
  if (left.kind !== right.kind) {
    return false;
  }

  if (
    left.kind === 'account' &&
    right.kind === 'account'
  ) {
    return left.ownerId === right.ownerId;
  }

  return true;
}

export function getActiveJahizLocalNamespace():
  JahizLocalNamespace {
  return activeNamespace;
}

export function setActiveJahizLocalNamespace(
  namespace: JahizLocalNamespace,
): number {
  activeNamespace = namespace;
  namespaceGeneration += 1;

  return namespaceGeneration;
}

export function getJahizLocalNamespaceGeneration():
  number {
  return namespaceGeneration;
}

export function beginJahizLocalNamespaceTransition():
  void {
  namespaceTransitionDepth += 1;
}

export function endJahizLocalNamespaceTransition():
  void {
  namespaceTransitionDepth =
    Math.max(
      0,
      namespaceTransitionDepth - 1,
    );
}

export function isJahizLocalNamespaceTransitioning():
  boolean {
  return namespaceTransitionDepth > 0;
}

export function jahizLocalNamespaceStorageKey(
  logicalKey: string,
  namespace:
    JahizLocalNamespace =
      getActiveJahizLocalNamespace(),
): string {
  const normalized =
    logicalKey.trim();

  if (
    !normalized ||
    !SAFE_STORAGE_KEY_PATTERN.test(
      normalized,
    )
  ) {
    throw new Error(
      'Jahiz logical storage key contains unsafe characters.',
    );
  }

  const namespaceSegment =
    namespace.kind === 'anonymous'
      ? 'anonymous'
      : `account.${namespace.ownerId}`;

  return [
    LOCAL_NAMESPACE_STORAGE_PREFIX,
    namespaceSegment,
    normalized,
  ].join('.');
}

export function createJahizNamespacedStorage(
  storage: JahizStringStorage,
  getNamespace:
    () => JahizLocalNamespace =
      getActiveJahizLocalNamespace,
): JahizStringStorage {
  return {
    getItem(key) {
      return storage.getItem(
        jahizLocalNamespaceStorageKey(
          key,
          getNamespace(),
        ),
      );
    },
    setItem(
      key,
      value,
    ) {
      return storage.setItem(
        jahizLocalNamespaceStorageKey(
          key,
          getNamespace(),
        ),
        value,
      );
    },
    removeItem(key) {
      return storage.removeItem(
        jahizLocalNamespaceStorageKey(
          key,
          getNamespace(),
        ),
      );
    },
  };
}
