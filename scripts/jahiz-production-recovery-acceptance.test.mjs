import assert from 'node:assert/strict';
import {
  mkdtemp,
  rm,
  stat,
} from 'node:fs/promises';
import {
  tmpdir,
} from 'node:os';
import path from 'node:path';
import {
  spawnSync,
} from 'node:child_process';
import test from 'node:test';

import pg from 'pg';

import {
  createPostgresPool,
} from '../apps/api/src/db.mjs';
import {
  createTripRepository,
} from '../apps/api/src/trip-repository.mjs';

const {
  Client,
} = pg;

let databaseCounter = 0;

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

function databaseEnvironment(
  database,
) {
  return {
    ...process.env,
    POSTGRES_DB: database,
    PGPASSWORD:
      process.env.POSTGRES_PASSWORD ?? '',
  };
}

function safeDatabaseName(
  label,
) {
  databaseCounter += 1;

  const value =
    [
      'jahiz_recovery',
      label,
      process.pid,
      Date.now(),
      databaseCounter,
    ]
      .join('_')
      .toLowerCase()
      .replace(
        /[^a-z0-9_]/gu,
        '_',
      )
      .slice(0, 60);

  assert.match(
    value,
    /^[a-z][a-z0-9_]+$/u,
  );

  return value;
}

function quoteIdentifier(
  value,
) {
  assert.match(
    value,
    /^[a-z][a-z0-9_]+$/u,
  );

  return `"${value}"`;
}

async function withAdmin(
  callback,
) {
  const client =
    new Client(
      databaseConfig(
        'postgres',
      ),
    );

  await client.connect();

  try {
    return await callback(
      client,
    );
  } finally {
    await client.end();
  }
}

async function createDatabase(
  database,
) {
  await withAdmin(
    (client) =>
      client.query(
        `CREATE DATABASE ${quoteIdentifier(database)}`,
      ),
  );
}

async function dropDatabase(
  database,
) {
  await withAdmin(
    (client) =>
      client.query(
        `DROP DATABASE IF EXISTS ${quoteIdentifier(database)} WITH (FORCE)`,
      ),
  );
}

function runCommand(
  command,
  args,
  env,
) {
  const result =
    spawnSync(
      command,
      args,
      {
        cwd:
          process.cwd(),
        env,
        encoding:
          'utf8',
        maxBuffer:
          20 * 1024 * 1024,
      },
    );

  assert.equal(
    result.status,
    0,
    [
      `${command} failed.`,
      result.stdout,
      result.stderr,
    ].join('\n'),
  );

  return result;
}

function runMigrations(
  database,
) {
  const result =
    runCommand(
      process.execPath,
      [
        'scripts/jahiz-apply-postgres-migrations.mjs',
      ],
      databaseEnvironment(
        database,
      ),
    );

  assert.match(
    result.stdout,
    /PostgreSQL migration validation passed\./u,
  );
}

function workspace(
  id,
  availableNow,
  marker,
) {
  return {
    id,
    version: 1,
    currency: 'AED',
    route: null,
    dates: {
      departureDate: null,
      returnDate: null,
      flexibility: 'fixed',
    },
    profile: {
      travelStyle: 'smart',
      travelStyleConfirmed: true,
      purpose: 'leisure',
      travelers: {
        adults: 1,
        children: 0,
      },
    },
    funds: {
      availableNow,
      expectedBeforeTravel: 0,
      safetyReserve: 1000,
      originCommitments: 0,
    },
    costItems: [],
    payments: [],
    commitments: [],
    moneyIn: [],
    recoveryMarker:
      marker,
    createdAt:
      '2026-09-02T06:45:00.000Z',
    updatedAt:
      '2026-09-02T06:45:00.000Z',
  };
}

async function seedSourceDatabase(
  database,
) {
  const ownerId =
    'recovery-owner';

  const pool =
    createPostgresPool({
      ...databaseConfig(
        database,
      ),
      max: 2,
    });

  const repository =
    createTripRepository(
      pool,
    );

  try {
    await pool.query(
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

    await pool.query(
      `
        INSERT INTO jahiz_identity_link (
          provider,
          provider_subject,
          user_id
        )
        VALUES (
          'clerk',
          'user_recovery_acceptance',
          $1
        )
      `,
      [
        ownerId,
      ],
    );

    const activeTrip =
      workspace(
        'recovery-active',
        4100,
        'active-v0',
      );

    const createdActive =
      await repository
        .createTrip({
          ownerId,
          clientMutationId:
            'recovery-create-active',
          workspace:
            activeTrip,
          serverUpdatedAt:
            new Date(
              '2026-09-02T06:46:00.000Z',
            ),
        });

    assert.equal(
      createdActive.status,
      'applied',
    );

    const updatedActive =
      await repository
        .updateTrip({
          ownerId,
          tripId:
            activeTrip.id,
          expectedRevision: 0,
          clientMutationId:
            'recovery-update-active',
          workspace:
            workspace(
              activeTrip.id,
              6100,
              'active-v1',
            ),
          serverUpdatedAt:
            new Date(
              '2026-09-02T06:47:00.000Z',
            ),
        });

    assert.equal(
      updatedActive.status,
      'applied',
    );
    assert.equal(
      updatedActive.trip.revision,
      1,
    );

    const archivedTrip =
      workspace(
        'recovery-archived',
        5200,
        'archived-v0',
      );

    const createdArchived =
      await repository
        .createTrip({
          ownerId,
          clientMutationId:
            'recovery-create-archived',
          workspace:
            archivedTrip,
          serverUpdatedAt:
            new Date(
              '2026-09-02T06:48:00.000Z',
            ),
        });

    assert.equal(
      createdArchived.status,
      'applied',
    );

    const archived =
      await repository
        .transitionTripLifecycle({
          ownerId,
          tripId:
            archivedTrip.id,
          expectedRevision: 0,
          clientMutationId:
            'recovery-archive',
          targetStatus:
            'archived',
          serverUpdatedAt:
            new Date(
              '2026-09-02T06:49:00.000Z',
            ),
        });

    assert.equal(
      archived.status,
      'applied',
    );
    assert.equal(
      archived.trip.lifecycle.status,
      'archived',
    );

    const deletedTrip =
      workspace(
        'recovery-deleted',
        6300,
        'deleted-v0',
      );

    const createdDeleted =
      await repository
        .createTrip({
          ownerId,
          clientMutationId:
            'recovery-create-deleted',
          workspace:
            deletedTrip,
          serverUpdatedAt:
            new Date(
              '2026-09-02T06:50:00.000Z',
            ),
        });

    assert.equal(
      createdDeleted.status,
      'applied',
    );

    const deleted =
      await repository
        .transitionTripLifecycle({
          ownerId,
          tripId:
            deletedTrip.id,
          expectedRevision: 0,
          clientMutationId:
            'recovery-delete',
          targetStatus:
            'deleted',
          serverUpdatedAt:
            new Date(
              '2026-09-02T06:51:00.000Z',
            ),
        });

    assert.equal(
      deleted.status,
      'applied',
    );
    assert.equal(
      deleted.trip.lifecycle.status,
      'deleted',
    );

    return {
      ownerId,
    };
  } finally {
    await pool.end();
  }
}

function dumpDatabase(
  database,
  dumpPath,
) {
  runCommand(
    'pg_dump',
    [
      '--host',
      String(
        process.env.POSTGRES_HOST,
      ),
      '--port',
      String(
        process.env.POSTGRES_PORT,
      ),
      '--username',
      String(
        process.env.POSTGRES_USER,
      ),
      '--dbname',
      database,
      '--format',
      'custom',
      '--no-owner',
      '--no-privileges',
      '--file',
      dumpPath,
    ],
    databaseEnvironment(
      database,
    ),
  );
}

function restoreDatabase(
  database,
  dumpPath,
) {
  runCommand(
    'pg_restore',
    [
      '--host',
      String(
        process.env.POSTGRES_HOST,
      ),
      '--port',
      String(
        process.env.POSTGRES_PORT,
      ),
      '--username',
      String(
        process.env.POSTGRES_USER,
      ),
      '--dbname',
      database,
      '--no-owner',
      '--no-privileges',
      '--exit-on-error',
      dumpPath,
    ],
    databaseEnvironment(
      database,
    ),
  );
}

test(
  'logical backup restores canonical identity, trip history, lifecycle and migration state into an empty database',
  async () => {
    const sourceDatabase =
      safeDatabaseName(
        'source',
      );

    const targetDatabase =
      safeDatabaseName(
        'target',
      );

    const tempDirectory =
      await mkdtemp(
        path.join(
          tmpdir(),
          'jahiz-recovery-',
        ),
      );

    const dumpPath =
      path.join(
        tempDirectory,
        'jahiz.dump',
      );

    let sourceCreated =
      false;
    let targetCreated =
      false;

    try {
      await createDatabase(
        sourceDatabase,
      );
      sourceCreated = true;

      runMigrations(
        sourceDatabase,
      );

      const {
        ownerId,
      } =
        await seedSourceDatabase(
          sourceDatabase,
        );

      dumpDatabase(
        sourceDatabase,
        dumpPath,
      );

      const dumpStats =
        await stat(
          dumpPath,
        );

      assert.ok(
        dumpStats.size > 0,
        'Backup dump must not be empty.',
      );

      await createDatabase(
        targetDatabase,
      );
      targetCreated = true;

      restoreDatabase(
        targetDatabase,
        dumpPath,
      );

      const restoredPool =
        createPostgresPool({
          ...databaseConfig(
            targetDatabase,
          ),
          max: 2,
        });

      const restoredRepository =
        createTripRepository(
          restoredPool,
        );

      try {
        const identity =
          await restoredPool
            .query(
              `
                SELECT
                  provider,
                  provider_subject,
                  user_id
                FROM jahiz_identity_link
                WHERE provider = 'clerk'
                  AND provider_subject =
                    'user_recovery_acceptance'
              `,
            );

        assert.deepEqual(
          identity.rows,
          [
            {
              provider:
                'clerk',
              provider_subject:
                'user_recovery_acceptance',
              user_id:
                ownerId,
            },
          ],
        );

        const trips =
          await restoredRepository
            .listTrips(
              ownerId,
              'all',
            );

        assert.deepEqual(
          trips
            .sort(
              (
                left,
                right,
              ) =>
                left.tripId
                  .localeCompare(
                    right.tripId,
                  ),
            )
            .map(
              (trip) => [
                trip.tripId,
                trip.revision,
                trip.lifecycle.status,
                trip.workspace
                  .recoveryMarker,
              ],
            ),
          [
            [
              'recovery-active',
              1,
              'active',
              'active-v1',
            ],
            [
              'recovery-archived',
              1,
              'archived',
              'archived-v0',
            ],
            [
              'recovery-deleted',
              1,
              'deleted',
              'deleted-v0',
            ],
          ],
        );

        const revisions =
          await restoredPool
            .query(
              `
                SELECT
                  trip_id,
                  revision,
                  mutation_kind,
                  client_mutation_id
                FROM jahiz_trip_revision
                ORDER BY
                  trip_id ASC,
                  revision ASC
              `,
            );

        assert.deepEqual(
          revisions.rows.map(
            (row) => [
              row.trip_id,
              Number(
                row.revision,
              ),
              row.mutation_kind,
              row.client_mutation_id,
            ],
          ),
          [
            [
              'recovery-active',
              0,
              'create',
              'recovery-create-active',
            ],
            [
              'recovery-active',
              1,
              'workspace',
              'recovery-update-active',
            ],
            [
              'recovery-archived',
              0,
              'create',
              'recovery-create-archived',
            ],
            [
              'recovery-archived',
              1,
              'lifecycle',
              'recovery-archive',
            ],
            [
              'recovery-deleted',
              0,
              'create',
              'recovery-create-deleted',
            ],
            [
              'recovery-deleted',
              1,
              'lifecycle',
              'recovery-delete',
            ],
          ],
        );

        const ledger =
          await restoredPool
            .query(
              `
                SELECT
                  migration_name,
                  checksum_sha256
                FROM jahiz_schema_migration
                ORDER BY
                  migration_name ASC
              `,
            );

        assert.equal(
          ledger.rows.length,
          6,
        );

        assert.equal(
          ledger.rows.every(
            (row) =>
              /^[0-9a-f]{64}$/u
                .test(
                  String(
                    row.checksum_sha256,
                  ),
                ),
          ),
          true,
        );

        const postRestoreUpdate =
          await restoredRepository
            .updateTrip({
              ownerId,
              tripId:
                'recovery-active',
              expectedRevision: 1,
              clientMutationId:
                'recovery-post-restore-update',
              workspace:
                workspace(
                  'recovery-active',
                  7100,
                  'active-v2-restored',
                ),
              serverUpdatedAt:
                new Date(
                  '2026-09-02T06:55:00.000Z',
                ),
            });

        assert.equal(
          postRestoreUpdate.status,
          'applied',
        );
        assert.equal(
          postRestoreUpdate.trip
            .revision,
          2,
        );

        const resurrection =
          await restoredRepository
            .transitionTripLifecycle({
              ownerId,
              tripId:
                'recovery-deleted',
              expectedRevision: 1,
              clientMutationId:
                'recovery-resurrection-attempt',
              targetStatus:
                'active',
              serverUpdatedAt:
                new Date(
                  '2026-09-02T06:56:00.000Z',
                ),
            });

        assert.equal(
          resurrection.status,
          'invalid_transition',
        );
        assert.equal(
          resurrection.trip
            .lifecycle.status,
          'deleted',
        );

        await assert.rejects(
          restoredPool.query(
            `
              DELETE FROM jahiz_user
              WHERE id = $1
            `,
            [
              ownerId,
            ],
          ),
          /foreign key|violates/iu,
        );
      } finally {
        await restoredPool.end();
      }

      const rerun =
        runCommand(
          process.execPath,
          [
            'scripts/jahiz-apply-postgres-migrations.mjs',
          ],
          databaseEnvironment(
            targetDatabase,
          ),
        );

      assert.match(
        rerun.stdout,
        /0 pending/u,
      );
    } finally {
      if (targetCreated) {
        await dropDatabase(
          targetDatabase,
        );
      }

      if (sourceCreated) {
        await dropDatabase(
          sourceDatabase,
        );
      }

      await rm(
        tempDirectory,
        {
          recursive: true,
          force: true,
        },
      );
    }
  },
);
