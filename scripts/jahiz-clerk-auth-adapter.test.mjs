import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createClerkBearerAuthenticator,
} from '../apps/api/src/clerk-auth-adapter.mjs';

test(
  'Clerk adapter derives provider identity only from a verified token',
  async () => {
    let resolverInput = null;
    let verifyInput = null;

    const authenticate =
      createClerkBearerAuthenticator({
        jwtKey: 'test-public-key',
        authorizedParties: [
          'https://jahiz.example',
        ],
        async resolveOwnerId(input) {
          resolverInput = input;
          return 'usr_internal_42';
        },
        async verifyTokenFn(
          token,
          options,
        ) {
          verifyInput = {
            token,
            options,
          };

          return {
            sub: 'user_clerk_42',
            sid: 'sess_clerk_42',
          };
        },
      });

    const principal =
      await authenticate({
        headers: {
          authorization:
            'Bearer signed-clerk-token',
        },
      });

    assert.deepEqual(
      resolverInput,
      {
        provider: 'clerk',
        providerSubject:
          'user_clerk_42',
      },
    );

    assert.equal(
      verifyInput.token,
      'signed-clerk-token',
    );

    assert.deepEqual(
      verifyInput.options
        .authorizedParties,
      ['https://jahiz.example'],
    );

    assert.deepEqual(
      principal,
      {
        ownerId: 'usr_internal_42',
        provider: 'clerk',
        providerSubject:
          'user_clerk_42',
        sessionId:
          'sess_clerk_42',
        authMode: 'production',
      },
    );
  },
);

test(
  'client-supplied owner metadata is ignored',
  async () => {
    const authenticate =
      createClerkBearerAuthenticator({
        secretKey:
          'test-secret-key',
        async resolveOwnerId() {
          return 'usr_server_owned';
        },
        async verifyTokenFn() {
          return {
            sub: 'user_clerk_1',
            sid: null,
          };
        },
      });

    const principal =
      await authenticate({
        headers: {
          authorization:
            'Bearer token',
          'x-owner-id':
            'usr_client_forged',
        },
      });

    assert.equal(
      principal.ownerId,
      'usr_server_owned',
    );
  },
);

test(
  'missing invalid or unverifiable bearer tokens fail closed',
  async () => {
    const authenticate =
      createClerkBearerAuthenticator({
        jwtKey: 'test-public-key',
        async resolveOwnerId() {
          throw new Error(
            'resolver must not run',
          );
        },
        async verifyTokenFn() {
          throw new Error(
            'invalid token',
          );
        },
      });

    assert.equal(
      await authenticate({
        headers: {},
      }),
      null,
    );

    assert.equal(
      await authenticate({
        headers: {
          authorization:
            'Bearer invalid',
        },
      }),
      null,
    );
  },
);

test(
  'verified identity without a Jahiz owner mapping remains unauthorized',
  async () => {
    const authenticate =
      createClerkBearerAuthenticator({
        jwtKey: 'test-public-key',
        async resolveOwnerId() {
          return null;
        },
        async verifyTokenFn() {
          return {
            sub: 'user_clerk_unmapped',
            sid: 'sess_unmapped',
          };
        },
      });

    assert.equal(
      await authenticate({
        headers: {
          authorization:
            'Bearer valid-but-unmapped',
        },
      }),
      null,
    );
  },
);

test(
  'adapter refuses construction without verification credentials or owner resolver',
  () => {
    assert.throws(() =>
      createClerkBearerAuthenticator({
        jwtKey: undefined,
        secretKey: undefined,
        resolveOwnerId:
          async () => 'usr_1',
      }),
    );

    assert.throws(() =>
      createClerkBearerAuthenticator({
        jwtKey: 'test-key',
      }),
    );
  },
);
