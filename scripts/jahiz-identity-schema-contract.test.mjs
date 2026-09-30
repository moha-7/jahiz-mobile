import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const sql =
  fs.readFileSync(
    new URL(
      '../infrastructure/postgres/002_jahiz_identity.sql',
      import.meta.url,
    ),
    'utf8',
  );

const ownershipSql =
  fs.readFileSync(
    new URL(
      '../infrastructure/postgres/003_jahiz_trip_owner_integrity.sql',
      import.meta.url,
    ),
    'utf8',
  );

test(
  'identity schema defines stable Jahiz user and external identity link',
  () => {
    assert.match(
      sql,
      /CREATE TABLE IF NOT EXISTS jahiz_user/i,
    );

    assert.match(
      sql,
      /CREATE TABLE IF NOT EXISTS jahiz_identity_link/i,
    );

    assert.match(
      sql,
      /PRIMARY KEY\s*\(provider,\s*provider_subject\)/i,
    );

    assert.match(
      sql,
      /REFERENCES jahiz_user\s*\(id\)/i,
    );
  },
);

test(
  'identity schema does not make provider subject the Jahiz owner id',
  () => {
    assert.match(
      sql,
      /user_id TEXT NOT NULL/i,
    );

    assert.doesNotMatch(
      sql,
      /provider_subject TEXT PRIMARY KEY/i,
    );
  },
);

test(
  'trip ownership foreign-key cutover is intentionally absent in M7G.3',
  () => {
    assert.doesNotMatch(
      sql,
      /ALTER TABLE jahiz_trip/i,
    );

    assert.doesNotMatch(
      sql,
      /REFERENCES jahiz_trip/i,
    );
  },
);

test(
  'M9 ownership migration fails closed when orphan trips exist',
  () => {
    assert.equal(
      ownershipSql.includes(
        'LEFT JOIN jahiz_user u',
      ),
      true,
    );

    assert.equal(
      ownershipSql.includes(
        'WHERE u.id IS NULL',
      ),
      true,
    );

    assert.equal(
      ownershipSql.includes(
        'RAISE EXCEPTION USING',
      ),
      true,
    );
  },
);

test(
  'M9 ownership migration binds every trip to a Jahiz user with restricted deletion',
  () => {
    assert.equal(
      ownershipSql.includes(
        'FOREIGN KEY (owner_id)',
      ),
      true,
    );

    assert.equal(
      ownershipSql.includes(
        'REFERENCES jahiz_user(id)',
      ),
      true,
    );

    assert.equal(
      ownershipSql.includes(
        'ON DELETE RESTRICT',
      ),
      true,
    );

    assert.equal(
      ownershipSql.includes(
        'jahiz_trip_owner_user_fk',
      ),
      true,
    );
  },
);
