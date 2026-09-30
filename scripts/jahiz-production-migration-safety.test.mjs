import assert from 'node:assert/strict';

import {
  spawn,
  spawnSync,
} from 'node:child_process';

import fs from 'node:fs/promises';

import {
  createHash,
} from 'node:crypto';

import {
  createRequire,
} from 'node:module';

import test from 'node:test';


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


const repoRoot =
  process.cwd();


let counter =
  0;


function safeDatabaseName(
  label,
) {
  counter += 1;

  const raw =
    `jahiz_m95b_${label}_${process.pid}_${Date.now()}_${counter}`;

  const normalized =
    raw
      .toLowerCase()
      .replace(
        /[^a-z0-9_]/gu,
        '_',
      )
      .slice(
        0,
        60,
      );

  assert.match(
    normalized,
    /^[a-z][a-z0-9_]+$/u,
  );

  return normalized;
}


function quotedIdentifier(
  value,
) {
  assert.match(
    value,
    /^[a-z][a-z0-9_]+$/u,
  );

  return `"${value}"`;
}


function databaseConfig(
  database,
) {
  return {
    host:
      process.env.POSTGRES_HOST,

    port:
      Number(
        process.env.POSTGRES_PORT,
      ),

    user:
      process.env.POSTGRES_USER,

    password:
      process.env.POSTGRES_PASSWORD,

    database,
  };
}


async function createDatabase(
  label,
) {
  const database =
    safeDatabaseName(
      label,
    );

  const admin =
    new Client(
      databaseConfig(
        'postgres',
      ),
    );

  await admin.connect();

  try {
    await admin.query(
      `CREATE DATABASE ${quotedIdentifier(database)}`,
    );
  }
  finally {
    await admin.end();
  }

  return database;
}


async function dropDatabase(
  database,
) {
  const admin =
    new Client(
      databaseConfig(
        'postgres',
      ),
    );

  await admin.connect();

  try {
    await admin.query(
      `DROP DATABASE IF EXISTS ${quotedIdentifier(database)} WITH (FORCE)`,
    );
  }
  finally {
    await admin.end();
  }
}


function migrationEnvironment(
  database,
) {
  return {
    ...process.env,

    POSTGRES_DB:
      database,
  };
}


function runMigrator(
  database,
) {
  return spawnSync(
    process.execPath,
    [
      'scripts/jahiz-apply-postgres-migrations.mjs',
    ],
    {
      cwd:
        repoRoot,

      env:
        migrationEnvironment(
          database,
        ),

      encoding:
        'utf8',

      maxBuffer:
        10 * 1024 * 1024,
    },
  );
}


function runMigratorAsync(
  database,
) {
  return new Promise(
    (resolve) => {
      const child =
        spawn(
          process.execPath,
          [
            'scripts/jahiz-apply-postgres-migrations.mjs',
          ],
          {
            cwd:
              repoRoot,

            env:
              migrationEnvironment(
                database,
              ),

            stdio: [
              'ignore',
              'pipe',
              'pipe',
            ],
          },
        );

      let stdout =
        '';

      let stderr =
        '';

      child.stdout.on(
        'data',
        (chunk) => {
          stdout +=
            chunk.toString();
        },
      );

      child.stderr.on(
        'data',
        (chunk) => {
          stderr +=
            chunk.toString();
        },
      );

      child.once(
        'exit',
        (
          code,
          signal,
        ) => {
          resolve({
            code,
            signal,
            stdout,
            stderr,
          });
        },
      );
    },
  );
}


async function withDatabase(
  label,
  callback,
) {
  const database =
    await createDatabase(
      label,
    );

  try {
    return await callback(
      database,
    );
  }
  finally {
    await dropDatabase(
      database,
    );
  }
}


async function readLedger(
  database,
) {
  const client =
    new Client(
      databaseConfig(
        database,
      ),
    );

  await client.connect();

  try {
    const result =
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

    return result.rows;
  }
  finally {
    await client.end();
  }
}


async function migrationSources() {
  const directory =
    new URL(
      '../infrastructure/postgres/',
      import.meta.url,
    );

  const names =
    (
      await fs.readdir(
        directory,
      )
    )
      .filter(
        (name) =>
          /^\d+_.+\.sql$/u.test(
            name,
          ),
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

  const sources =
    [];

  for (
    const name
    of names
  ) {
    const raw =
      await fs.readFile(
        new URL(
          name,
          directory,
        ),
      );

    const canonical =
      raw
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

    sources.push({
      name,
      canonical,

      checksum:
        createHash(
          'sha256',
        )
          .update(
            canonical,
            'utf8',
          )
          .digest(
            'hex',
          ),
    });
  }

  return sources;
}


test(
  'concurrent production migration runners serialize and record one exact ledger',
  async () => {
    await withDatabase(
      'concurrent',
      async (
        database,
      ) => {

        const [
          first,
          second,
        ] =
          await Promise.all([
            runMigratorAsync(
              database,
            ),
            runMigratorAsync(
              database,
            ),
          ]);


        assert.equal(
          first.code,
          0,
          first.stderr,
        );

        assert.equal(
          second.code,
          0,
          second.stderr,
        );


        const ledger =
          await readLedger(
            database,
          );


        assert.deepEqual(
          ledger.map(
            (row) =>
              row.migration_name,
          ),
          [
            '001_jahiz_server_truth.sql',
            '002_jahiz_identity.sql',
            '003_jahiz_trip_owner_integrity.sql',
            '004_jahiz_trip_lifecycle.sql',
            '005_jahiz_trip_tombstone.sql',
            '006_jahiz_trip_mutation_identity.sql',
          ],
        );


        assert.equal(
          new Set(
            ledger.map(
              (row) =>
                row.migration_name,
            ),
          ).size,
          6,
        );


        assert.equal(
          ledger.every(
            (row) =>
              /^[0-9a-f]{64}$/u.test(
                String(
                  row.checksum_sha256,
                ).trim(),
              ),
          ),
          true,
        );
      },
    );
  },
);


test(
  'verified migration rerun is a zero-op and preserves applied timestamps',
  async () => {
    await withDatabase(
      'noop',
      async (
        database,
      ) => {

        const first =
          runMigrator(
            database,
          );

        assert.equal(
          first.status,
          0,
          first.stderr,
        );


        const before =
          await readLedger(
            database,
          );


        const second =
          runMigrator(
            database,
          );

        assert.equal(
          second.status,
          0,
          second.stderr,
        );

        assert.match(
          second.stdout,
          /Verified 6 applied migration\(s\); 0 pending\./u,
        );


        const after =
          await readLedger(
            database,
          );


        assert.deepEqual(
          after.map(
            (row) => [
              row.migration_name,
              String(
                row.checksum_sha256,
              ).trim(),
              new Date(
                row.applied_at,
              ).toISOString(),
            ],
          ),
          before.map(
            (row) => [
              row.migration_name,
              String(
                row.checksum_sha256,
              ).trim(),
              new Date(
                row.applied_at,
              ).toISOString(),
            ],
          ),
        );
      },
    );
  },
);


test(
  'existing pre-ledger M9 database is safely adopted without losing canonical data',
  async () => {
    await withDatabase(
      'adoption',
      async (
        database,
      ) => {

        const sources =
          await migrationSources();

        const client =
          new Client(
            databaseConfig(
              database,
            ),
          );

        await client.connect();

        try {

          // Reproduce the pre-M9.5 migration behavior:
          // apply all migration files directly with no ledger.
          for (
            const migration
            of sources
          ) {
            await client.query(
              migration.canonical,
            );
          }


          const ownerId =
            'm95b-adoption-owner';

          const tripId =
            'm95b-adoption-trip';


          await client.query(
            `
              INSERT INTO jahiz_user (
                id,
                status
              )
              VALUES (
                $1,
                'active'
              )
            `,
            [
              ownerId,
            ],
          );


          await client.query(
            `
              INSERT INTO jahiz_trip (
                id,
                owner_id,
                revision,
                lifecycle_status,
                archived_at,
                deleted_at,
                workspace
              )
              VALUES (
                $1,
                $2,
                0,
                'active',
                NULL,
                NULL,
                $3::jsonb
              )
            `,
            [
              tripId,
              ownerId,
              JSON.stringify({
                id:
                  tripId,

                durabilityMarker:
                  'preserve-me',
              }),
            ],
          );


          await client.query(
            `
              INSERT INTO jahiz_trip_revision (
                trip_id,
                revision,
                client_mutation_id,
                source,
                mutation_kind,
                lifecycle_status,
                archived_at,
                deleted_at,
                workspace
              )
              VALUES (
                $1,
                0,
                'm95b-adoption-create',
                'migration',
                'create',
                'active',
                NULL,
                NULL,
                $2::jsonb
              )
            `,
            [
              tripId,
              JSON.stringify({
                id:
                  tripId,

                durabilityMarker:
                  'preserve-me',
              }),
            ],
          );
        }
        finally {
          await client.end();
        }


        const migrated =
          runMigrator(
            database,
          );

        assert.equal(
          migrated.status,
          0,
          migrated.stderr,
        );


        const ledger =
          await readLedger(
            database,
          );

        assert.equal(
          ledger.length,
          6,
        );


        const verification =
          new Client(
            databaseConfig(
              database,
            ),
          );

        await verification.connect();

        try {
          const result =
            await verification.query(
              `
                SELECT
                  revision,
                  lifecycle_status,
                  workspace
                FROM jahiz_trip
                WHERE id =
                  'm95b-adoption-trip'
              `,
            );


          assert.equal(
            result.rows.length,
            1,
          );

          assert.equal(
            Number(
              result.rows[0]
                .revision,
            ),
            0,
          );

          assert.equal(
            result.rows[0]
              .lifecycle_status,
            'active',
          );

          assert.equal(
            result.rows[0]
              .workspace
              .durabilityMarker,
            'preserve-me',
          );
        }
        finally {
          await verification.end();
        }
      },
    );
  },
);


test(
  'checksum drift fails closed before any pending migration can be recorded',
  async () => {
    await withDatabase(
      'checksum',
      async (
        database,
      ) => {

        const baseline =
          runMigrator(
            database,
          );

        assert.equal(
          baseline.status,
          0,
          baseline.stderr,
        );


        const client =
          new Client(
            databaseConfig(
              database,
            ),
          );

        await client.connect();

        try {
          await client.query(
            `
              UPDATE jahiz_schema_migration
              SET checksum_sha256 =
                repeat('0', 64)
              WHERE migration_name =
                '001_jahiz_server_truth.sql'
            `,
          );

          await client.query(
            `
              DELETE FROM jahiz_schema_migration
              WHERE migration_name =
                '006_jahiz_trip_mutation_identity.sql'
            `,
          );
        }
        finally {
          await client.end();
        }


        const rerun =
          runMigrator(
            database,
          );

        assert.notEqual(
          rerun.status,
          0,
        );

        assert.match(
          rerun.stderr,
          /Checksum mismatch for applied migration: 001_jahiz_server_truth[.]sql/u,
        );


        const ledger =
          await readLedger(
            database,
          );


        assert.equal(
          ledger.some(
            (row) =>
              row.migration_name ===
              '006_jahiz_trip_mutation_identity.sql',
          ),
          false,
        );
      },
    );
  },
);


test(
  'non-prefix migration history fails closed instead of replaying a gap',
  async () => {
    await withDatabase(
      'gap',
      async (
        database,
      ) => {

        const baseline =
          runMigrator(
            database,
          );

        assert.equal(
          baseline.status,
          0,
          baseline.stderr,
        );


        const client =
          new Client(
            databaseConfig(
              database,
            ),
          );

        await client.connect();

        try {
          await client.query(
            `
              DELETE FROM jahiz_schema_migration
              WHERE migration_name =
                '003_jahiz_trip_owner_integrity.sql'
            `,
          );
        }
        finally {
          await client.end();
        }


        const rerun =
          runMigrator(
            database,
          );

        assert.notEqual(
          rerun.status,
          0,
        );

        assert.match(
          rerun.stderr,
          /Migration history is non-prefix or contains a gap/u,
        );
      },
    );
  },
);


test(
  'database migration history ahead of the deployed build fails closed',
  async () => {
    await withDatabase(
      'ahead',
      async (
        database,
      ) => {

        const baseline =
          runMigrator(
            database,
          );

        assert.equal(
          baseline.status,
          0,
          baseline.stderr,
        );


        const client =
          new Client(
            databaseConfig(
              database,
            ),
          );

        await client.connect();

        try {
          await client.query(
            `
              INSERT INTO jahiz_schema_migration (
                migration_name,
                checksum_sha256
              )
              VALUES (
                '999_future_schema.sql',
                repeat('f', 64)
              )
            `,
          );
        }
        finally {
          await client.end();
        }


        const rerun =
          runMigrator(
            database,
          );

        assert.notEqual(
          rerun.status,
          0,
        );

        assert.match(
          rerun.stderr,
          /Database migration history is ahead of this build: 999_future_schema[.]sql/u,
        );
      },
    );
  },
);
