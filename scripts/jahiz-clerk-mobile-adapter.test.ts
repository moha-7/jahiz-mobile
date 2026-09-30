import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createClerkTokenSource,
  mapClerkProviderSession,
} from '../apps/mobile/src/features/auth/jahiz-clerk-auth-adapter.ts';
import {
  buildJahizAuthorizationHeader,
} from '../apps/mobile/src/features/auth/jahiz-auth-session.ts';

test(
  'Clerk provider loading remains Jahiz loading',
  () => {
    assert.deepEqual(
      mapClerkProviderSession({
        isLoaded: false,
        isSignedIn: undefined,
        userId: undefined,
        sessionId: undefined,
        async getToken() {
          return null;
        },
      }),
      {
        status: 'loading',
      },
    );
  },
);

test(
  'loaded signed-out provider maps to anonymous',
  () => {
    assert.deepEqual(
      mapClerkProviderSession({
        isLoaded: true,
        isSignedIn: false,
        userId: null,
        sessionId: null,
        async getToken() {
          return null;
        },
      }),
      {
        status: 'anonymous',
      },
    );
  },
);

test(
  'signed-in Clerk identity is provider-authenticated but not yet a Jahiz owner',
  () => {
    const state =
      mapClerkProviderSession({
        isLoaded: true,
        isSignedIn: true,
        userId: 'user_clerk_7',
        sessionId:
          'sess_clerk_7',
        async getToken() {
          return 'token';
        },
      });

    assert.deepEqual(
      state,
      {
        status:
          'provider-authenticated',
        provider: 'clerk',
        providerSubject:
          'user_clerk_7',
        sessionId:
          'sess_clerk_7',
      },
    );

    assert.equal(
      'ownerId' in state,
      false,
    );
  },
);

test(
  'Clerk token source is queried on demand and not persisted',
  async () => {
    let calls = 0;

    const source =
      createClerkTokenSource(
        async () => {
          calls += 1;
          return 'fresh-token';
        },
      );

    assert.equal(calls, 0);

    assert.equal(
      await buildJahizAuthorizationHeader(
        source,
      ),
      'Bearer fresh-token',
    );

    assert.equal(calls, 1);
  },
);
