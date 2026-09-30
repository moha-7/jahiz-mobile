import assert from 'node:assert/strict';
import test, {
  after,
  before,
  beforeEach,
} from 'node:test';

import pg from 'pg';

import {
  createJahizIdentityRepository,
} from '../apps/api/src/identity-repository.mjs';

const {
  Pool,
} = pg;

const pool =
  new Pool({
    host:
      process.env.POSTGRES_HOST ??
      '127.0.0.1',
    port:
      Number(
        process.env.POSTGRES_PORT ??
        '5432',
      ),
    user:
      process.env.POSTGRES_USER ??
      'jahiz',
    password:
      process.env.POSTGRES_PASSWORD ??
      'jahiz',
    database:
      process.env.POSTGRES_DB ??
      'jahiz',
  });

before(async () => {
  await pool.query('SELECT 1');
});

beforeEach(async () => {
  await pool.query(
    `
      TRUNCATE TABLE
        jahiz_identity_link,
        jahiz_user
      CASCADE
    `,
  );
});

after(async () => {
  await pool.end();
});

test(
  'first verified provider identity creates one stable Jahiz owner',
  async () => {
    let sequence = 0;

    const repository =
      createJahizIdentityRepository(
        pool,
        {
          ownerIdFactory() {
            sequence += 1;
            return `usr_test_${sequence}`;
          },
        },
      );

    const first =
      await repository
        .ensureOwnerForIdentity({
          provider: 'clerk',
          providerSubject:
            'user_provider_1',
        });

    const second =
      await repository
        .ensureOwnerForIdentity({
          provider: 'clerk',
          providerSubject:
            'user_provider_1',
        });

    assert.deepEqual(
      first,
      {
        status: 'active',
        ownerId: 'usr_test_1',
        created: true,
      },
    );

    assert.deepEqual(
      second,
      {
        status: 'active',
        ownerId: 'usr_test_1',
        created: false,
      },
    );

    assert.equal(sequence, 1);
  },
);

test(
  'different provider subjects receive different Jahiz owners',
  async () => {
    const ids = [
      'usr_a',
      'usr_b',
    ];

    const repository =
      createJahizIdentityRepository(
        pool,
        {
          ownerIdFactory() {
            return ids.shift();
          },
        },
      );

    const a =
      await repository
        .ensureOwnerForIdentity({
          provider: 'clerk',
          providerSubject:
            'user_provider_a',
        });

    const b =
      await repository
        .ensureOwnerForIdentity({
          provider: 'clerk',
          providerSubject:
            'user_provider_b',
        });

    assert.equal(
      a.ownerId,
      'usr_a',
    );
    assert.equal(
      b.ownerId,
      'usr_b',
    );
    assert.notEqual(
      a.ownerId,
      b.ownerId,
    );
  },
);

test(
  'resolveOwnerId returns only active mapped accounts',
  async () => {
    const repository =
      createJahizIdentityRepository(
        pool,
        {
          ownerIdFactory() {
            return 'usr_active_1';
          },
        },
      );

    await repository
      .ensureOwnerForIdentity({
        provider: 'clerk',
        providerSubject:
          'user_provider_active',
      });

    assert.equal(
      await repository.resolveOwnerId({
        provider: 'clerk',
        providerSubject:
          'user_provider_active',
      }),
      'usr_active_1',
    );

    await pool.query(
      `
        UPDATE jahiz_user
        SET status = 'disabled'
        WHERE id = $1
      `,
      ['usr_active_1'],
    );

    assert.equal(
      await repository.resolveOwnerId({
        provider: 'clerk',
        providerSubject:
          'user_provider_active',
      }),
      null,
    );
  },
);

test(
  'disabled identity cannot silently create a replacement account',
  async () => {
    const repository =
      createJahizIdentityRepository(
        pool,
        {
          ownerIdFactory() {
            return 'usr_blocked_1';
          },
        },
      );

    await repository
      .ensureOwnerForIdentity({
        provider: 'clerk',
        providerSubject:
          'user_provider_blocked',
      });

    await pool.query(
      `
        UPDATE jahiz_user
        SET status = 'disabled'
        WHERE id = $1
      `,
      ['usr_blocked_1'],
    );

    const result =
      await repository
        .ensureOwnerForIdentity({
          provider: 'clerk',
          providerSubject:
            'user_provider_blocked',
        });

    assert.deepEqual(
      result,
      {
        status: 'blocked',
        ownerId: null,
        created: false,
      },
    );

    const count =
      await pool.query(
        `
          SELECT COUNT(*)::int AS count
          FROM jahiz_user
        `,
      );

    assert.equal(
      count.rows[0].count,
      1,
    );
  },
);

test(
  'provider and subject validation fail closed',
  async () => {
    const repository =
      createJahizIdentityRepository(
        pool,
      );

    await assert.rejects(() =>
      repository.resolveOwnerId({
        provider: 'Clerk',
        providerSubject: 'subject',
      }),
    );

    await assert.rejects(() =>
      repository.resolveOwnerId({
        provider: 'clerk',
        providerSubject: '',
      }),
    );
  },
);
