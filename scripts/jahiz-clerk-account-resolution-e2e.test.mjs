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
  createClerkAccountAuthenticator,
} from '../apps/api/src/clerk-account-authenticator.mjs';

const pool =
  createPostgresPool();

const tripRepository =
  createTripRepository(pool);

let ownerSequence = 0;

const identityRepository =
  createJahizIdentityRepository(
    pool,
    {
      ownerIdFactory() {
        ownerSequence += 1;
        return `usr_e2e_${ownerSequence}`;
      },
    },
  );

const tokenClaims =
  new Map([
    [
      'token-a',
      {
        sub: 'clerk_user_a',
        sid: 'clerk_session_a',
      },
    ],
    [
      'token-b',
      {
        sub: 'clerk_user_b',
        sid: 'clerk_session_b',
      },
    ],
    [
      'token-concurrent',
      {
        sub: 'clerk_user_concurrent',
        sid: 'clerk_session_concurrent',
      },
    ],
  ]);

const authenticateRequest =
  createClerkAccountAuthenticator({
    identityRepository,
    jwtKey: 'test-jwt-key',
    async verifyTokenFn(token) {
      const claims =
        tokenClaims.get(token);

      if (!claims) {
        throw new Error(
          'invalid token',
        );
      }

      return claims;
    },
  });

const app =
  buildApiServer({
    repository: tripRepository,
    authenticateRequest,
  });

const serverTruthMigration =
  new URL(
    '../infrastructure/postgres/001_jahiz_server_truth.sql',
    import.meta.url,
  );

const identityMigration =
  new URL(
    '../infrastructure/postgres/002_jahiz_identity.sql',
    import.meta.url,
  );

const lifecycleMigration =
  new URL(
    '../infrastructure/postgres/004_jahiz_trip_lifecycle.sql',
    import.meta.url,
  );

const tombstoneMigration =
  new URL(
    '../infrastructure/postgres/005_jahiz_trip_tombstone.sql',
    import.meta.url,
  );

const mutationIdentityMigration =
  new URL(
    '../infrastructure/postgres/006_jahiz_trip_mutation_identity.sql',
    import.meta.url,
  );

before(async () => {
  await pool.query(
    await fs.readFile(
      serverTruthMigration,
      'utf8',
    ),
  );

  await pool.query(
    await fs.readFile(
      identityMigration,
      'utf8',
    ),
  );

  await pool.query(
    await fs.readFile(
      lifecycleMigration,
      'utf8',
    ),
  );

  await pool.query(
    await fs.readFile(
      tombstoneMigration,
      'utf8',
    ),
  );

  await pool.query(
    await fs.readFile(
      mutationIdentityMigration,
      'utf8',
    ),
  );
});

beforeEach(async () => {
  ownerSequence = 0;

  await pool.query(
    `
      TRUNCATE TABLE
        jahiz_trip_revision,
        jahiz_trip,
        jahiz_identity_link,
        jahiz_user
      CASCADE
    `,
  );
});

after(async () => {
  await app.close();
  await pool.end();
});

async function authenticatedMissingTrip(
  token,
  extraHeaders = {},
) {
  return app.inject({
    method: 'GET',
    url:
      '/v1/trips/m7g4-missing-trip',
    headers: {
      authorization:
        `Bearer ${token}`,
      ...extraHeaders,
    },
  });
}

async function identityRows() {
  const result =
    await pool.query(
      `
        SELECT
          u.id,
          u.status,
          l.provider,
          l.provider_subject
        FROM jahiz_user u
        INNER JOIN jahiz_identity_link l
          ON l.user_id = u.id
        ORDER BY l.provider_subject
      `,
    );

  return result.rows;
}

test(
  'first verified Clerk request provisions a Jahiz owner before BFF access',
  async () => {
    const response =
      await authenticatedMissingTrip(
        'token-a',
      );

    assert.equal(
      response.statusCode,
      404,
    );

    const rows =
      await identityRows();

    assert.equal(
      rows.length,
      1,
    );
    assert.equal(
      rows[0].provider,
      'clerk',
    );
    assert.equal(
      rows[0].provider_subject,
      'clerk_user_a',
    );
    assert.equal(
      rows[0].id,
      'usr_e2e_1',
    );
    assert.notEqual(
      rows[0].id,
      rows[0].provider_subject,
    );
  },
);

test(
  'repeated verified identity reuses one stable Jahiz owner',
  async () => {
    const first =
      await authenticatedMissingTrip(
        'token-a',
      );

    const second =
      await authenticatedMissingTrip(
        'token-a',
      );

    assert.equal(
      first.statusCode,
      404,
    );
    assert.equal(
      second.statusCode,
      404,
    );

    const rows =
      await identityRows();

    assert.equal(
      rows.length,
      1,
    );
    assert.equal(
      rows[0].id,
      'usr_e2e_1',
    );
    assert.equal(
      ownerSequence,
      1,
    );
  },
);

test(
  'different verified provider subjects remain isolated',
  async () => {
    assert.equal(
      (
        await authenticatedMissingTrip(
          'token-a',
        )
      ).statusCode,
      404,
    );

    assert.equal(
      (
        await authenticatedMissingTrip(
          'token-b',
        )
      ).statusCode,
      404,
    );

    const rows =
      await identityRows();

    assert.equal(
      rows.length,
      2,
    );

    assert.deepEqual(
      rows.map(
        (row) =>
          row.provider_subject,
      ),
      [
        'clerk_user_a',
        'clerk_user_b',
      ],
    );

    assert.notEqual(
      rows[0].id,
      rows[1].id,
    );
  },
);

test(
  'client owner headers never become account authority',
  async () => {
    const response =
      await authenticatedMissingTrip(
        'token-a',
        {
          'x-owner-id':
            'usr_forged_client',
        },
      );

    assert.equal(
      response.statusCode,
      404,
    );

    const rows =
      await identityRows();

    assert.equal(
      rows.length,
      1,
    );
    assert.notEqual(
      rows[0].id,
      'usr_forged_client',
    );
  },
);

test(
  'disabled mapped account fails closed and is not silently replaced',
  async () => {
    assert.equal(
      (
        await authenticatedMissingTrip(
          'token-a',
        )
      ).statusCode,
      404,
    );

    const before =
      await identityRows();

    await pool.query(
      `
        UPDATE jahiz_user
        SET status = 'disabled'
        WHERE id = $1
      `,
      [before[0].id],
    );

    const blocked =
      await authenticatedMissingTrip(
        'token-a',
      );

    assert.equal(
      blocked.statusCode,
      401,
    );

    const after =
      await identityRows();

    assert.equal(
      after.length,
      1,
    );
    assert.equal(
      ownerSequence,
      1,
    );
  },
);

test(
  'invalid provider token is unauthorized before any account is created',
  async () => {
    const response =
      await authenticatedMissingTrip(
        'bad-token',
      );

    assert.equal(
      response.statusCode,
      401,
    );

    assert.deepEqual(
      await identityRows(),
      [],
    );
  },
);

test(
  'concurrent first requests converge to one identity link and one owner',
  async () => {
    const responses =
      await Promise.all(
        Array.from(
          {
            length: 8,
          },
          () =>
            authenticatedMissingTrip(
              'token-concurrent',
            ),
        ),
      );

    assert.equal(
      responses.every(
        (response) =>
          response.statusCode === 404,
      ),
      true,
    );

    const rows =
      await identityRows();

    assert.equal(
      rows.length,
      1,
    );
    assert.equal(
      rows[0].provider_subject,
      'clerk_user_concurrent',
    );

    const users =
      await pool.query(
        `
          SELECT COUNT(*)::int AS count
          FROM jahiz_user
        `,
      );

    assert.equal(
      users.rows[0].count,
      1,
    );
  },
);
