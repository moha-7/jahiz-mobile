import {
  createHash,
} from 'node:crypto';

import fs from 'node:fs/promises';

import path from 'node:path';

import {
  createRequire,
} from 'node:module';


const require =
  createRequire(
    import.meta.url,
  );

const {
  Client,
} =
  require(
    'pg',
  );


const requiredEnvironment = [
  'POSTGRES_HOST',
  'POSTGRES_PORT',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_DB',
];


for (
  const name
  of requiredEnvironment
) {
  if (!process.env[name]) {
    throw new Error(
      `Missing required database environment variable: ${name}`,
    );
  }
}


const port =
  Number(
    process.env.POSTGRES_PORT,
  );


if (
  !Number.isInteger(
    port,
  ) ||
  port <= 0 ||
  port > 65535
) {
  throw new Error(
    'POSTGRES_PORT must be a valid TCP port.',
  );
}


const migrationDirectory =
  path.resolve(
    'infrastructure',
    'postgres',
  );


function canonicalMigrationSource(
  buffer,
) {
  const source =
    buffer
      .toString(
        'utf8',
      )
      .replace(
        /^\uFEFF/u,
        '',
      )
      .replace(
        /\r\n?/gu,
        '\n',
      );

  if (
    source.includes(
      '\u0000',
    )
  ) {
    throw new Error(
      'Migration source contains a NUL byte.',
    );
  }

  return source;
}


function checksum(
  source,
) {
  return createHash(
    'sha256',
  )
    .update(
      source,
      'utf8',
    )
    .digest(
      'hex',
    );
}


function unwrapTransactionEnvelope(
  source,
  file,
) {
  const beginPattern =
    /^[ \t]*BEGIN;[ \t]*$/gimu;

  const commitPattern =
    /^[ \t]*COMMIT;[ \t]*$/gimu;

  const rollbackPattern =
    /^[ \t]*ROLLBACK;[ \t]*$/gimu;


  const begins =
    [
      ...source.matchAll(
        beginPattern,
      ),
    ];

  const commits =
    [
      ...source.matchAll(
        commitPattern,
      ),
    ];

  const rollbacks =
    [
      ...source.matchAll(
        rollbackPattern,
      ),
    ];


  if (
    rollbacks.length !== 0
  ) {
    throw new Error(
      `Migration contains unsupported ROLLBACK transaction control: ${file}`,
    );
  }


  if (
    begins.length === 0 &&
    commits.length === 0
  ) {
    return source;
  }


  if (
    begins.length !== 1 ||
    commits.length !== 1 ||
    begins[0].index >=
      commits[0].index
  ) {
    throw new Error(
      `Migration transaction envelope is unsupported: ${file}`,
    );
  }


  return source
    .replace(
      beginPattern,
      '',
    )
    .replace(
      commitPattern,
      '',
    );
}


const entries =
  await fs.readdir(
    migrationDirectory,
    {
      withFileTypes:
        true,
    },
  );


const migrationFiles =
  entries
    .filter(
      (entry) =>
        entry.isFile() &&
        /^\d+_.+\.sql$/u.test(
          entry.name,
        ),
    )
    .map(
      (entry) =>
        entry.name,
    )
    .sort(
      (
        left,
        right,
      ) =>
        left.localeCompare(
          right,
          'en',
          {
            numeric:
              true,
          },
        ),
    );


if (
  migrationFiles.length === 0
) {
  throw new Error(
    'No PostgreSQL migrations were found.',
  );
}


const migrations =
  [];


for (
  const file
  of migrationFiles
) {
  const absolutePath =
    path.join(
      migrationDirectory,
      file,
    );

  const raw =
    await fs.readFile(
      absolutePath,
    );

  const source =
    canonicalMigrationSource(
      raw,
    );

  if (
    !source.trim()
  ) {
    throw new Error(
      `Migration is empty: ${file}`,
    );
  }

  migrations.push({
    file,

    checksum:
      checksum(
        source,
      ),

    sql:
      unwrapTransactionEnvelope(
        source,
        file,
      ),
  });
}


const client =
  new Client({
    host:
      process.env.POSTGRES_HOST,

    port,

    user:
      process.env.POSTGRES_USER,

    password:
      process.env.POSTGRES_PASSWORD,

    database:
      process.env.POSTGRES_DB,
  });


let lockHeld =
  false;


await client.connect();


try {

  // Cluster/session lock serializes deployments that target
  // this Jahiz schema at the same time.
  await client.query(
    `
      SELECT pg_advisory_lock(
        hashtext('jahiz'),
        hashtext('schema_migrations_v1')
      )
    `,
  );

  lockHeld =
    true;


  await client.query(
    `
      CREATE TABLE IF NOT EXISTS
        jahiz_schema_migration (
          migration_name TEXT
            PRIMARY KEY,

          checksum_sha256 CHAR(64)
            NOT NULL,

          applied_at TIMESTAMPTZ
            NOT NULL
            DEFAULT now(),

          CONSTRAINT
            jahiz_schema_migration_name_check
            CHECK (
              migration_name ~
              '^[0-9]+_.+[.]sql$'
            ),

          CONSTRAINT
            jahiz_schema_migration_checksum_check
            CHECK (
              checksum_sha256 ~
              '^[0-9a-f]{64}$'
            )
        )
    `,
  );


  const appliedResult =
    await client.query(
      `
        SELECT
          migration_name,
          checksum_sha256,
          applied_at
        FROM jahiz_schema_migration
        ORDER BY migration_name ASC
      `,
    );


  const sourceByName =
    new Map(
      migrations.map(
        (migration) => [
          migration.file,
          migration,
        ],
      ),
    );


  const appliedByName =
    new Map(
      appliedResult.rows.map(
        (row) => [
          row.migration_name,
          row,
        ],
      ),
    );


  // A database with migrations unknown to this build means
  // an older binary is being pointed at a newer database.
  for (
    const row
    of appliedResult.rows
  ) {
    if (
      !sourceByName.has(
        row.migration_name,
      )
    ) {
      throw new Error(
        `Database migration history is ahead of this build: ${row.migration_name}`,
      );
    }
  }


  // Applied migrations must always be an exact prefix of
  // the source migration chain.
  let missingSeen =
    false;

  for (
    const migration
    of migrations
  ) {
    const exists =
      appliedByName.has(
        migration.file,
      );

    if (!exists) {
      missingSeen =
        true;

      continue;
    }

    if (missingSeen) {
      throw new Error(
        `Migration history is non-prefix or contains a gap at: ${migration.file}`,
      );
    }
  }


  // Validate all historical checksums BEFORE applying any
  // pending migration.
  for (
    const migration
    of migrations
  ) {
    const applied =
      appliedByName.get(
        migration.file,
      );

    if (!applied) {
      continue;
    }

    const persistedChecksum =
      String(
        applied.checksum_sha256,
      ).trim();

    if (
      persistedChecksum !==
      migration.checksum
    ) {
      throw new Error(
        `Checksum mismatch for applied migration: ${migration.file}`,
      );
    }
  }


  const pending =
    migrations.filter(
      (migration) =>
        !appliedByName.has(
          migration.file,
        ),
    );


  console.log(
    `Discovered ${migrations.length} migration(s).`,
  );

  console.log(
    `Verified ${appliedByName.size} applied migration(s); ${pending.length} pending.`,
  );


  for (
    const migration
    of pending
  ) {
    console.log(
      `Applying ${migration.file}`,
    );

    await client.query(
      'BEGIN',
    );

    try {

      await client.query(
        migration.sql,
      );


      await client.query(
        `
          INSERT INTO jahiz_schema_migration (
            migration_name,
            checksum_sha256
          )
          VALUES (
            $1,
            $2
          )
        `,
        [
          migration.file,
          migration.checksum,
        ],
      );


      await client.query(
        'COMMIT',
      );
    }
    catch (error) {

      await client.query(
        'ROLLBACK',
      );

      throw error;
    }
  }


  console.log(
    'PostgreSQL migration validation passed.',
  );
}
finally {

  if (lockHeld) {
    try {
      await client.query(
        `
          SELECT pg_advisory_unlock(
            hashtext('jahiz'),
            hashtext('schema_migrations_v1')
          )
        `,
      );
    }
    catch {
      // Connection close also releases session advisory locks.
    }
  }

  await client.end();
}
