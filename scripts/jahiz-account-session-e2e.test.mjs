import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test, {
  after,
  before,
  beforeEach,
} from 'node:test';

import {
  createPostgresPool,
} from '../apps/api/src/db.mjs';
import {
  buildApiServer,
} from '../apps/api/src/http-app.mjs';
import {
  createTripRepository,
} from '../apps/api/src/trip-repository.mjs';
import {
  createJahizIdentityRepository,
} from '../apps/api/src/identity-repository.mjs';
import {
  createJahizRuntimeAuthenticator,
} from '../apps/api/src/auth-runtime-selector.mjs';

const pool =
  createPostgresPool();

const repository =
  createTripRepository(pool);

let ownerSequence = 0;

const identityRepository =
  createJahizIdentityRepository(
    pool,
    {
      ownerIdFactory() {
        ownerSequence += 1;
        return `usr_session_${ownerSequence}`;
      },
    },
  );

const authenticateRequest =
  createJahizRuntimeAuthenticator({
    mode: 'clerk',
    nodeEnv: 'production',
    identityRepository,
    clerkOptions: {
      jwtKey: 'test-key',
      async verifyTokenFn(token) {
        if (token === 'token-one') {
          return {
            sub: 'clerk_user_one',
            sid: 'clerk_session_one',
          };
        }

        if (token === 'token-two') {
          return {
            sub: 'clerk_user_two',
            sid: 'clerk_session_two',
          };
        }

        throw new Error(
          'invalid token',
        );
      },
    },
  });

const app =
  buildApiServer({
    repository,
    authenticateRequest,
  });

before(async () => {
  await pool.query(
    await fs.readFile(
      new URL(
        '../infrastructure/postgres/001_jahiz_server_truth.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );

  await pool.query(
    await fs.readFile(
      new URL(
        '../infrastructure/postgres/002_jahiz_identity.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
});

beforeEach(async () => {
  ownerSequence = 0;

  await pool.query(
    `TRUNCATE TABLE
       jahiz_trip_revision,
       jahiz_trip,
       jahiz_identity_link,
       jahiz_user
     CASCADE`,
  );
});

after(async () => {
  await app.close();
  await pool.end();
});

async function getSession(token) {
  return app.inject({
    method: 'GET',
    url:
      '/v1/account/session',
    headers: {
      authorization:
        `Bearer ${token}`,
    },
  });
}

test(
  'account session returns stable internal owner and minimal provider metadata',
  async () => {
    const first =
      await getSession(
        'token-one',
      );

    assert.equal(
      first.statusCode,
      200,
    );

    const body =
      first.json();

    assert.deepEqual(
      body,
      {
        data: {
          status:
            'authenticated',
          ownerId:
            'usr_session_1',
          provider: 'clerk',
          sessionId:
            'clerk_session_one',
        },
      },
    );

    assert.equal(
      'providerSubject' in
        body.data,
      false,
    );

    const second =
      await getSession(
        'token-one',
      );

    assert.equal(
      second.json().data.ownerId,
      'usr_session_1',
    );
    assert.equal(
      ownerSequence,
      1,
    );
  },
);

test(
  'different provider identities resolve to different internal owners',
  async () => {
    const one =
      await getSession(
        'token-one',
      );
    const two =
      await getSession(
        'token-two',
      );

    assert.notEqual(
      one.json().data.ownerId,
      two.json().data.ownerId,
    );
  },
);

test(
  'invalid provider token is unauthorized and creates no account',
  async () => {
    const response =
      await getSession(
        'bad-token',
      );

    assert.equal(
      response.statusCode,
      401,
    );

    const users =
      await pool.query(
        'SELECT COUNT(*)::int AS count FROM jahiz_user',
      );

    assert.equal(
      users.rows[0].count,
      0,
    );
  },
);
