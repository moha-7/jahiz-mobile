import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createJahizRuntimeAuthenticator,
  resolveJahizAuthMode,
} from '../apps/api/src/auth-runtime-selector.mjs';

test(
  'development is the non-production default only',
  () => {
    assert.equal(
      resolveJahizAuthMode({
        mode: undefined,
        nodeEnv: 'development',
      }),
      'development',
    );

    assert.throws(() =>
      resolveJahizAuthMode({
        mode: undefined,
        nodeEnv: 'production',
      }),
    );
  },
);

test(
  'development mode is forbidden in production',
  () => {
    assert.throws(() =>
      resolveJahizAuthMode({
        mode: 'development',
        nodeEnv: 'production',
      }),
    );
  },
);

test(
  'unknown auth mode fails closed',
  () => {
    assert.throws(() =>
      resolveJahizAuthMode({
        mode: 'other',
        nodeEnv: 'development',
      }),
    );
  },
);

test(
  'development runtime resolves provider subject to a stable internal Jahiz owner',
  async () => {
    const identityRepository = {
      async ensureOwnerForIdentity(
        identity,
      ) {
        assert.deepEqual(
          identity,
          {
            provider:
              'development',
            providerSubject:
              'runtime_user',
          },
        );

        return {
          status: 'active',
          ownerId:
            'usr_runtime_dev_1',
          created: false,
        };
      },
    };

    const authenticate =
      createJahizRuntimeAuthenticator({
        mode: 'development',
        nodeEnv: 'development',
        identityRepository,
        developmentOptions: {
          enabled: true,
        },
      });

    const principal =
      await authenticate({
        headers: {
          authorization:
            'Bearer dev:runtime_user',
        },
      });

    assert.equal(
      principal.ownerId,
      'usr_runtime_dev_1',
    );

    assert.equal(
      principal.provider,
      'development',
    );

    assert.equal(
      principal.providerSubject,
      'runtime_user',
    );

    assert.notEqual(
      principal.ownerId,
      principal.providerSubject,
    );
  },
);

test(
  'development runtime requires the Jahiz identity repository',
  () => {
    assert.throws(() =>
      createJahizRuntimeAuthenticator({
        mode: 'development',
        nodeEnv: 'development',
        developmentOptions: {
          enabled: true,
        },
      }),
    );
  },
);

test(
  'blocked development identity fails closed',
  async () => {
    const authenticate =
      createJahizRuntimeAuthenticator({
        mode: 'development',
        nodeEnv: 'development',

        identityRepository: {
          async ensureOwnerForIdentity() {
            return {
              status: 'blocked',
              ownerId: null,
              created: false,
            };
          },
        },

        developmentOptions: {
          enabled: true,
        },
      });

    const principal =
      await authenticate({
        headers: {
          authorization:
            'Bearer dev:blocked_user',
        },
      });

    assert.equal(
      principal,
      null,
    );
  },
);

test(
  'Clerk runtime resolves verified identity to internal Jahiz owner',
  async () => {
    const identityRepository = {
      async ensureOwnerForIdentity(
        identity,
      ) {
        assert.deepEqual(
          identity,
          {
            provider: 'clerk',
            providerSubject:
              'clerk_subject_1',
          },
        );

        return {
          status: 'active',
          ownerId:
            'usr_runtime_1',
          created: false,
        };
      },
    };

    const authenticate =
      createJahizRuntimeAuthenticator({
        mode: 'clerk',
        nodeEnv: 'production',
        identityRepository,
        clerkOptions: {
          jwtKey: 'test-key',
          async verifyTokenFn() {
            return {
              sub:
                'clerk_subject_1',
              sid:
                'clerk_session_1',
            };
          },
        },
      });

    const principal =
      await authenticate({
        headers: {
          authorization:
            'Bearer signed-token',
        },
      });

    assert.equal(
      principal.ownerId,
      'usr_runtime_1',
    );
    assert.equal(
      principal.provider,
      'clerk',
    );
    assert.equal(
      principal.authMode,
      'production',
    );
  },
);
