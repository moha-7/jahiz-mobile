import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildJahizAuthorizationHeader,
  createAnonymousJahizAuthState,
  createAuthenticatedJahizAuthState,
  createLoadingJahizAuthState,
} from '../apps/mobile/src/features/auth/jahiz-auth-session.ts';
import {
  evaluateJahizPortfolioAdoption,
} from '../apps/mobile/src/features/auth/jahiz-local-portfolio-adoption.ts';

test(
  'mobile auth state never needs to persist an access token',
  () => {
    const state =
      createAuthenticatedJahizAuthState({
        ownerId: 'usr_mobile_1',
        provider: 'clerk',
        providerSubject:
          'provider_user_1',
        sessionId: 'session_1',
      });

    assert.equal(
      state.status,
      'authenticated',
    );
    assert.equal(
      'accessToken' in state,
      false,
    );
    assert.equal(
      'refreshToken' in state,
      false,
    );
  },
);

test(
  'loading and anonymous states are explicit',
  () => {
    assert.equal(
      createLoadingJahizAuthState()
        .status,
      'loading',
    );

    assert.equal(
      createAnonymousJahizAuthState()
        .status,
      'anonymous',
    );
  },
);

test(
  'authorization header is built from an on-demand token source',
  async () => {
    assert.equal(
      await buildJahizAuthorizationHeader({
        async getAccessToken() {
          return 'signed-token';
        },
      }),
      'Bearer signed-token',
    );

    assert.equal(
      await buildJahizAuthorizationHeader({
        async getAccessToken() {
          return null;
        },
      }),
      undefined,
    );
  },
);

test(
  'anonymous local data can never auto-overwrite account data',
  () => {
    const blocked =
      evaluateJahizPortfolioAdoption({
        isAuthenticated: false,
        localCandidateTripCount: 2,
        remoteTripCount: 0,
      });

    assert.equal(
      blocked.status,
      'blocked-not-authenticated',
    );
    assert.equal(
      blocked.allowAutomaticOverwrite,
      false,
    );

    const unknownRemote =
      evaluateJahizPortfolioAdoption({
        isAuthenticated: true,
        localCandidateTripCount: 2,
        remoteTripCount: null,
      });

    assert.equal(
      unknownRemote.status,
      'awaiting-remote-truth',
    );
    assert.equal(
      unknownRemote.allowAutomaticOverwrite,
      false,
    );
  },
);

test(
  'local adoption requires confirmation and merge is explicit',
  () => {
    const adoption =
      evaluateJahizPortfolioAdoption({
        isAuthenticated: true,
        localCandidateTripCount: 2,
        remoteTripCount: 0,
      });

    assert.equal(
      adoption.status,
      'offer-local-adoption',
    );
    assert.equal(
      adoption.requiresUserConfirmation,
      true,
    );
    assert.equal(
      adoption.allowAutomaticOverwrite,
      false,
    );

    const merge =
      evaluateJahizPortfolioAdoption({
        isAuthenticated: true,
        localCandidateTripCount: 2,
        remoteTripCount: 3,
      });

    assert.equal(
      merge.status,
      'merge-required',
    );
    assert.equal(
      merge.allowAutomaticOverwrite,
      false,
    );
  },
);
