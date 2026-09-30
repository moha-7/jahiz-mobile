import {
  ClerkProvider,
  useAuth,
} from '@clerk/expo';
import {
  tokenCache,
} from '@clerk/expo/token-cache';
import type {
  JahizAuthState,
} from '@jahiz/api-contracts';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  resolveJahizAccountSession,
  type JahizAccountSessionResolution,
} from '@/features/auth/jahiz-account-session-http';
import {
  createAnonymousJahizAuthState,
  createAuthenticatedJahizAuthState,
  createLoadingJahizAuthState,
  buildJahizAuthorizationHeader,
} from '@/features/auth/jahiz-auth-session';
import {
  createClerkTokenSource,
  mapClerkProviderSession,
} from '@/features/auth/jahiz-clerk-auth-adapter';
import {
  resolveJahizMobileAuthRuntimeConfig,
  type JahizMobileAuthRuntimeMode,
} from '@/features/auth/jahiz-mobile-auth-runtime-config';
import {
  accountJahizLocalNamespace,
  anonymousJahizLocalNamespace,
} from '@/features/local-persistence/jahiz-local-namespace';
import {
  ensureInternalLegacyTripPersistenceReset,
  loadVerifiedLocalOwnerId,
  saveVerifiedLocalAccountBinding,
} from '@/features/local-persistence/jahiz-local-persistence-platform';
import {
  switchTripLocalNamespace,
} from '@/features/trip-workspace/trip-workspace-store';

type AccountResolutionStatus =
  | 'idle'
  | 'resolving'
  | JahizAccountSessionResolution['status'];

type JahizAuthRuntimeContextValue = {
  mode:
    JahizMobileAuthRuntimeMode;
  state: JahizAuthState;
  accountResolution:
    AccountResolutionStatus;
  localOwnerId:
    string | null;
  getAuthorizationHeader:
    () => Promise<string | undefined>;
  signOut:
    () => Promise<void>;
};

const JahizAuthRuntimeContext =
  createContext<
    JahizAuthRuntimeContextValue
    | undefined
  >(undefined);

const mobileAuthRuntimeConfig =
  resolveJahizMobileAuthRuntimeConfig({
    mode:
      process.env.EXPO_PUBLIC_JAHIZ_AUTH_MODE,
    publishableKey:
      process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
    apiUrl:
      process.env.EXPO_PUBLIC_JAHIZ_API_URL,
  });

const noopGetAuthorizationHeader =
  async () => undefined;

const noopSignOut =
  async () => {};

function JahizDevelopmentAuthBoundary({
  children,
}: PropsWithChildren) {
  useEffect(() => {
    void ensureInternalLegacyTripPersistenceReset()
      .catch(() => undefined);
  }, []);

  const value =
    useMemo<
      JahizAuthRuntimeContextValue
    >(
      () => ({
        mode: 'development',
        state:
          createAnonymousJahizAuthState(),
        accountResolution: 'idle',
        localOwnerId: null,
        getAuthorizationHeader:
          noopGetAuthorizationHeader,
        signOut: noopSignOut,
      }),
      [],
    );

  return (
    <JahizAuthRuntimeContext.Provider
      value={value}
    >
      {children}
    </JahizAuthRuntimeContext.Provider>
  );
}

function JahizClerkAccountBridge({
  apiUrl,
  children,
}: PropsWithChildren<{
  apiUrl: string;
}>) {
  const {
    getToken,
    isLoaded,
    isSignedIn,
    sessionId,
    signOut: clerkSignOut,
    userId,
  } = useAuth();

  const getTokenRef =
    useRef(getToken);

  getTokenRef.current =
    getToken;

  const stableGetToken =
    useCallback(
      (
        ...args:
          Parameters<typeof getToken>
      ) =>
        getTokenRef.current(...args),
      [],
    );

  const providerSession =
    useMemo(
      () =>
        mapClerkProviderSession({
          isLoaded,
          isSignedIn,
          userId,
          sessionId,
          getToken:
            stableGetToken,
        }),
      [
        isLoaded,
        isSignedIn,
        sessionId,
        stableGetToken,
        userId,
      ],
    );

  const [
    state,
    setState,
  ] = useState<JahizAuthState>(
    () =>
      createLoadingJahizAuthState(),
  );

  const [
    accountResolution,
    setAccountResolution,
  ] =
    useState<AccountResolutionStatus>(
      'idle',
    );

  const [
    localOwnerId,
    setLocalOwnerId,
  ] = useState<string | null>(
    null,
  );

  const requestVersion =
    useRef(0);

  const tokenSource =
    useMemo(
      () =>
        createClerkTokenSource(
          stableGetToken,
        ),
      [stableGetToken],
    );

  const getAuthorizationHeader =
    useCallback(
      () =>
        buildJahizAuthorizationHeader(
          tokenSource,
        ),
      [tokenSource],
    );

  useEffect(() => {
    requestVersion.current += 1;

    const version =
      requestVersion.current;

    if (
      providerSession.status ===
        'loading'
    ) {
      setState(
        createLoadingJahizAuthState(),
      );
      setAccountResolution('idle');
      return;
    }

    if (
      providerSession.status ===
        'anonymous'
    ) {
      setState(
        createLoadingJahizAuthState(),
      );
      setAccountResolution(
        'resolving',
      );
      setLocalOwnerId(null);

      void (
        async () => {
          await switchTripLocalNamespace(
            anonymousJahizLocalNamespace(),
          );

          if (
            requestVersion.current !==
              version
          ) {
            return;
          }

          setState(
            createAnonymousJahizAuthState(),
          );
          setAccountResolution('idle');
        }
      )().catch(() => {
        if (
          requestVersion.current !==
            version
        ) {
          return;
        }

        setLocalOwnerId(null);
        setAccountResolution(
          'unavailable',
        );
        setState(
          createLoadingJahizAuthState(),
        );
      });

      return;
    }

    setState(
      createLoadingJahizAuthState(),
    );
    setAccountResolution(
      'resolving',
    );

    void (
      async () => {
        const cachedOwnerIdPromise =
          loadVerifiedLocalOwnerId(
            providerSession.provider,
            providerSession
              .providerSubject,
          );

        const result =
          await resolveJahizAccountSession({
            apiUrl,
            providerSession,
            getAuthorizationHeader,
          });

        if (
          requestVersion.current !==
            version
        ) {
          return;
        }

        if (
          result.status ===
            'resolved'
        ) {
          await saveVerifiedLocalAccountBinding(
            result.identity,
          );

          await switchTripLocalNamespace(
            accountJahizLocalNamespace(
              result.identity.ownerId,
            ),
          );

          if (
            requestVersion.current !==
              version
          ) {
            return;
          }

          setLocalOwnerId(
            result.identity.ownerId,
          );
          setAccountResolution(
            'resolved',
          );
          setState(
            createAuthenticatedJahizAuthState(
              result.identity,
            ),
          );
          return;
        }

        if (
          result.status ===
            'unauthorized'
        ) {
          await switchTripLocalNamespace(
            anonymousJahizLocalNamespace(),
          );

          if (
            requestVersion.current !==
              version
          ) {
            return;
          }

          setLocalOwnerId(null);
          setAccountResolution(
            'unauthorized',
          );
          setState(
            createAnonymousJahizAuthState(),
          );
          return;
        }

        if (
          result.status ===
            'unavailable'
        ) {
          const cachedOwnerId =
            await cachedOwnerIdPromise;

          if (
            requestVersion.current !==
              version
          ) {
            return;
          }

          if (cachedOwnerId) {
            await switchTripLocalNamespace(
              accountJahizLocalNamespace(
                cachedOwnerId,
              ),
            );
          } else {
            await switchTripLocalNamespace(
              anonymousJahizLocalNamespace(),
            );
          }

          if (
            requestVersion.current !==
              version
          ) {
            return;
          }

          setLocalOwnerId(
            cachedOwnerId,
          );
          setAccountResolution(
            'unavailable',
          );
          setState(
            createLoadingJahizAuthState(),
          );
          return;
        }

        // Provider/session mismatch is never allowed to unlock a cached
        // account namespace. Fail closed to the anonymous local namespace.
        await switchTripLocalNamespace(
          anonymousJahizLocalNamespace(),
        );

        if (
          requestVersion.current !==
            version
        ) {
          return;
        }

        setLocalOwnerId(null);
        setAccountResolution(
          'provider-mismatch',
        );
        setState(
          createLoadingJahizAuthState(),
        );
      }
    )().catch(() => {
      if (
        requestVersion.current !==
          version
      ) {
        return;
      }

      setLocalOwnerId(null);
      setAccountResolution(
        'unavailable',
      );
      setState(
        createLoadingJahizAuthState(),
      );
    });
  }, [
    apiUrl,
    getAuthorizationHeader,
    providerSession,
  ]);

  const signOut =
    useCallback(
      async () => {
        requestVersion.current += 1;

        // Hide authenticated local state immediately while Clerk signs out.
        // Persisted account data is retained and only the active namespace
        // is detached after the provider session is closed.
        setState(
          createLoadingJahizAuthState(),
        );
        setAccountResolution(
          'resolving',
        );

        await clerkSignOut();

        await switchTripLocalNamespace(
          anonymousJahizLocalNamespace(),
        );

        setLocalOwnerId(null);
        setState(
          createAnonymousJahizAuthState(),
        );
        setAccountResolution(
          'idle',
        );
      },
      [
        clerkSignOut,
      ],
    );

  const value =
    useMemo<
      JahizAuthRuntimeContextValue
    >(
      () => ({
        mode: 'clerk',
        state,
        accountResolution,
        localOwnerId,
        getAuthorizationHeader,
        signOut,
      }),
      [
        accountResolution,
        getAuthorizationHeader,
        localOwnerId,
        signOut,
        state,
      ],
    );

  return (
    <JahizAuthRuntimeContext.Provider
      value={value}
    >
      {children}
    </JahizAuthRuntimeContext.Provider>
  );
}

export function JahizAuthRuntimeProvider({
  children,
}: PropsWithChildren) {
  if (
    mobileAuthRuntimeConfig.mode ===
      'development'
  ) {
    return (
      <JahizDevelopmentAuthBoundary>
        {children}
      </JahizDevelopmentAuthBoundary>
    );
  }

  return (
    <ClerkProvider
      publishableKey={
        mobileAuthRuntimeConfig
          .publishableKey
      }
      tokenCache={tokenCache}
    >
      <JahizClerkAccountBridge
        apiUrl={
          mobileAuthRuntimeConfig
            .apiUrl
        }
      >
        {children}
      </JahizClerkAccountBridge>
    </ClerkProvider>
  );
}

export function useJahizAuthRuntime():
  JahizAuthRuntimeContextValue {
  const value =
    useContext(
      JahizAuthRuntimeContext,
    );

  if (!value) {
    throw new Error(
      'useJahizAuthRuntime must be used within JahizAuthRuntimeProvider.',
    );
  }

  return value;
}
