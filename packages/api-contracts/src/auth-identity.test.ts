import assert from 'node:assert/strict';
import test from 'node:test';

import {
  jahizAuthenticatedIdentitySchema,
  jahizAuthStateSchema,
} from './index.ts';

test(
  'authenticated identity separates Jahiz owner from provider subject',
  () => {
    const parsed =
      jahizAuthenticatedIdentitySchema.parse({
        ownerId: 'usr_local_001',
        provider: 'clerk',
        providerSubject:
          'user_provider_001',
        sessionId:
          'session_provider_001',
      });

    assert.equal(
      parsed.ownerId,
      'usr_local_001',
    );
    assert.equal(
      parsed.providerSubject,
      'user_provider_001',
    );
    assert.notEqual(
      parsed.ownerId,
      parsed.providerSubject,
    );
  },
);

test(
  'identity provider key stays normalized and provider-neutral',
  () => {
    assert.throws(() =>
      jahizAuthenticatedIdentitySchema.parse({
        ownerId: 'usr_1',
        provider: 'Clerk',
        providerSubject: 'subject_1',
        sessionId: null,
      }),
    );

    assert.equal(
      jahizAuthenticatedIdentitySchema.parse({
        ownerId: 'usr_1',
        provider: 'oidc.vendor-1',
        providerSubject: 'subject_1',
        sessionId: null,
      }).provider,
      'oidc.vendor-1',
    );
  },
);

test(
  'auth state has explicit loading anonymous and authenticated states',
  () => {
    assert.equal(
      jahizAuthStateSchema.parse({
        status: 'loading',
      }).status,
      'loading',
    );

    assert.equal(
      jahizAuthStateSchema.parse({
        status: 'anonymous',
      }).status,
      'anonymous',
    );

    const authenticated =
      jahizAuthStateSchema.parse({
        status: 'authenticated',
        identity: {
          ownerId: 'usr_2',
          provider: 'clerk',
          providerSubject: 'subject_2',
          sessionId: null,
        },
      });

    assert.equal(
      authenticated.status,
      'authenticated',
    );
  },
);

test(
  'blank owner and provider subjects fail closed',
  () => {
    assert.throws(() =>
      jahizAuthenticatedIdentitySchema.parse({
        ownerId: '',
        provider: 'clerk',
        providerSubject: 'subject',
        sessionId: null,
      }),
    );

    assert.throws(() =>
      jahizAuthenticatedIdentitySchema.parse({
        ownerId: 'usr_3',
        provider: 'clerk',
        providerSubject: '',
        sessionId: null,
      }),
    );
  },
);
