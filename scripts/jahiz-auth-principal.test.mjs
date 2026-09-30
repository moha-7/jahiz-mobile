import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDevelopmentBearerAuthenticator,
} from '../apps/api/src/auth.mjs';
import {
  createJahizAuthPrincipal,
} from '../apps/api/src/auth-principal.mjs';

test(
  'development bearer auth preserves owner boundary and emits full principal',
  async () => {
    const authenticate =
      createDevelopmentBearerAuthenticator({
        enabled: true,
        nodeEnv: 'development',
      });

    const principal =
      await authenticate({
        headers: {
          authorization:
            'Bearer dev:device_owner_1',
        },
      });

    assert.deepEqual(
      principal,
      {
        ownerId: 'device_owner_1',
        provider: 'development',
        providerSubject:
          'device_owner_1',
        sessionId: null,
        authMode: 'development',
      },
    );
  },
);

test(
  'development auth stays disabled unless explicitly enabled',
  async () => {
    const authenticate =
      createDevelopmentBearerAuthenticator({
        enabled: false,
        nodeEnv: 'development',
      });

    assert.equal(
      await authenticate({
        headers: {
          authorization:
            'Bearer dev:device_owner_1',
        },
      }),
      null,
    );
  },
);

test(
  'development authentication remains forbidden in production',
  () => {
    assert.throws(() =>
      createDevelopmentBearerAuthenticator({
        enabled: true,
        nodeEnv: 'production',
      }),
    );
  },
);

test(
  'generic principal validates provider-neutral production metadata',
  () => {
    const principal =
      createJahizAuthPrincipal({
        ownerId: 'usr_internal_1',
        provider: 'clerk',
        providerSubject:
          'provider_subject_1',
        sessionId:
          'provider_session_1',
        authMode: 'production',
      });

    assert.equal(
      principal.ownerId,
      'usr_internal_1',
    );
    assert.equal(
      principal.providerSubject,
      'provider_subject_1',
    );
    assert.equal(
      Object.isFrozen(principal),
      true,
    );
  },
);
