import assert from 'node:assert/strict';
import {
  spawn,
  spawnSync,
} from 'node:child_process';
import net from 'node:net';
import test from 'node:test';

import {
  createPostgresPool,
} from '../apps/api/src/db.mjs';


const repoRoot =
  process.cwd();


function workspace(
  id,
  availableNow,
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

    createdAt:
      '2026-08-31T12:55:00.000Z',

    updatedAt:
      '2026-08-31T12:55:00.000Z',
  };
}


function delay(
  milliseconds,
) {
  return new Promise(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds,
      );
    },
  );
}


async function allocatePort() {
  return new Promise(
    (resolve, reject) => {
      const server =
        net.createServer();

      server.unref();

      server.once(
        'error',
        reject,
      );

      server.listen(
        0,
        '127.0.0.1',
        () => {
          const address =
            server.address();

          if (
            !address ||
            typeof address ===
              'string'
          ) {
            server.close();

            reject(
              new Error(
                'Could not allocate API port.',
              ),
            );

            return;
          }

          const {
            port,
          } = address;

          server.close(
            () => {
              resolve(port);
            },
          );
        },
      );
    },
  );
}


function runMigrations() {
  const result =
    spawnSync(
      process.execPath,
      [
        'scripts/jahiz-apply-postgres-migrations.mjs',
      ],
      {
        cwd:
          repoRoot,

        env:
          process.env,

        encoding:
          'utf8',

        maxBuffer:
          10 * 1024 * 1024,
      },
    );

  assert.equal(
    result.status,
    0,
    [
      'Migration process failed.',
      result.stdout,
      result.stderr,
    ].join('\n'),
  );

  assert.match(
    result.stdout,
    /PostgreSQL migration validation passed\./,
  );
}


async function startApi() {
  const port =
    await allocatePort();

  let stdout = '';
  let stderr = '';
  let exitState = null;

  const child =
    spawn(
      process.execPath,
      [
        'apps/api/src/server.mjs',
      ],
      {
        cwd:
          repoRoot,

        env: {
          ...process.env,

          NODE_ENV:
            'test',

          JAHIZ_AUTH_MODE:
            'development',

          JAHIZ_DEV_AUTH_ENABLED:
            '1',

          JAHIZ_API_HOST:
            '127.0.0.1',

          JAHIZ_API_PORT:
            String(
              port,
            ),
        },

        stdio: [
          'ignore',
          'pipe',
          'pipe',
        ],
      },
    );

  child.stdout.on(
    'data',
    (chunk) => {
      stdout +=
        chunk.toString();

      if (
        stdout.length >
        100_000
      ) {
        stdout =
          stdout.slice(
            -100_000,
          );
      }
    },
  );

  child.stderr.on(
    'data',
    (chunk) => {
      stderr +=
        chunk.toString();

      if (
        stderr.length >
        100_000
      ) {
        stderr =
          stderr.slice(
            -100_000,
          );
      }
    },
  );

  const exitPromise =
    new Promise(
      (resolve) => {
        child.once(
          'exit',
          (
            code,
            signal,
          ) => {
            exitState = {
              code,
              signal,
            };

            resolve(
              exitState,
            );
          },
        );
      },
    );


  for (
    let attempt = 1;
    attempt <= 40;
    attempt += 1
  ) {
    if (exitState) {
      throw new Error(
        [
          'Jahiz API exited before health check.',
          JSON.stringify(
            exitState,
          ),
          stdout,
          stderr,
        ].join('\n'),
      );
    }

    try {
      const response =
        await fetch(
          `http://127.0.0.1:${port}/health`,
          {
            signal:
              AbortSignal.timeout(
                1000,
              ),
          },
        );

      if (response.ok) {
        const body =
          await response.json();

        if (
          body.status ===
          'ok'
        ) {
          return {
            child,
            port,
            exitPromise,

            logs() {
              return {
                stdout,
                stderr,
              };
            },
          };
        }
      }
    }
    catch {
      // Runtime may still be booting.
    }

    await delay(
      250,
    );
  }

  child.kill(
    'SIGTERM',
  );

  throw new Error(
    [
      'Jahiz API did not become healthy.',
      stdout,
      stderr,
    ].join('\n'),
  );
}


async function stopApi(
  runtime,
) {
  if (!runtime) {
    return;
  }

  if (
    runtime.child.exitCode !==
      null ||
    runtime.child.signalCode !==
      null
  ) {
    return;
  }

  runtime.child.kill(
    'SIGTERM',
  );

  await Promise.race([
    runtime.exitPromise,
    delay(
      5000,
    ),
  ]);

  if (
    runtime.child.exitCode ===
      null &&
    runtime.child.signalCode ===
      null
  ) {
    runtime.child.kill(
      'SIGKILL',
    );

    await runtime.exitPromise;
  }
}


async function apiRequest({
  runtime,
  token,
  method = 'GET',
  path,
  body,
}) {
  const headers = {
    authorization:
      `Bearer dev:${token}`,
  };

  if (
    body !== undefined
  ) {
    headers[
      'content-type'
    ] =
      'application/json';
  }

  const response =
    await fetch(
      `http://127.0.0.1:${runtime.port}${path}`,
      {
        method,
        headers,

        body:
          body === undefined
            ? undefined
            : JSON.stringify(
                body,
              ),

        signal:
          AbortSignal.timeout(
            5000,
          ),
      },
    );

  const text =
    await response.text();

  let parsed = null;

  if (text) {
    parsed =
      JSON.parse(
        text,
      );
  }

  return {
    status:
      response.status,

    body:
      parsed,
  };
}


test(
  'canonical account trips survive real API restarts and populated migration reapplication',
  async () => {
    const suffix =
      `${process.pid}-${Date.now()}`;

    const token =
      `m95durability-${suffix}`;

    const tripA =
      `m95-durable-a-${suffix}`;

    const tripB =
      `m95-durable-b-${suffix}`;

    const tripC =
      `m95-durable-c-${suffix}`;

    const createA =
      `m95-create-a-${suffix}`;

    const updateA1 =
      `m95-update-a1-${suffix}`;

    const updateA2 =
      `m95-update-a2-${suffix}`;

    const createB =
      `m95-create-b-${suffix}`;

    const archiveB =
      `m95-archive-b-${suffix}`;

    const createC =
      `m95-create-c-${suffix}`;

    const deleteC =
      `m95-delete-c-${suffix}`;


    let runtime1 = null;
    let runtime2 = null;
    let runtime3 = null;

    let ownerId = null;

    const auditPool =
      createPostgresPool({
        max: 2,
      });


    try {

      // ========================================================
      // DEPLOYMENT #1 — MIGRATE + BOOT + WRITE
      // ========================================================

      runMigrations();

      runtime1 =
        await startApi();


      const session1 =
        await apiRequest({
          runtime:
            runtime1,

          token,

          path:
            '/v1/account/session',
        });

      assert.equal(
        session1.status,
        200,
      );

      ownerId =
        session1.body
          .data
          .ownerId;

      assert.equal(
        typeof ownerId,
        'string',
      );


      const createdA =
        await apiRequest({
          runtime:
            runtime1,

          token,

          method:
            'POST',

          path:
            '/v1/trips',

          body: {
            clientMutationId:
              createA,

            workspace:
              workspace(
                tripA,
                4100,
              ),
          },
        });

      assert.equal(
        createdA.status,
        201,
      );

      assert.equal(
        createdA.body
          .data
          .revision,
        0,
      );


      const updatedA1 =
        await apiRequest({
          runtime:
            runtime1,

          token,

          method:
            'PUT',

          path:
            `/v1/trips/${tripA}`,

          body: {
            clientMutationId:
              updateA1,

            expectedRevision:
              0,

            workspace:
              workspace(
                tripA,
                6100,
              ),
          },
        });

      assert.equal(
        updatedA1.status,
        200,
      );

      assert.equal(
        updatedA1.body
          .data
          .revision,
        1,
      );


      const createdB =
        await apiRequest({
          runtime:
            runtime1,

          token,

          method:
            'POST',

          path:
            '/v1/trips',

          body: {
            clientMutationId:
              createB,

            workspace:
              workspace(
                tripB,
                5200,
              ),
          },
        });

      assert.equal(
        createdB.status,
        201,
      );


      const archivedB =
        await apiRequest({
          runtime:
            runtime1,

          token,

          method:
            'PATCH',

          path:
            `/v1/trips/${tripB}/lifecycle`,

          body: {
            clientMutationId:
              archiveB,

            expectedRevision:
              0,

            targetStatus:
              'archived',
          },
        });

      assert.equal(
        archivedB.status,
        200,
      );

      assert.equal(
        archivedB.body
          .data
          .lifecycle
          .status,
        'archived',
      );


      const createdC =
        await apiRequest({
          runtime:
            runtime1,

          token,

          method:
            'POST',

          path:
            '/v1/trips',

          body: {
            clientMutationId:
              createC,

            workspace:
              workspace(
                tripC,
                6300,
              ),
          },
        });

      assert.equal(
        createdC.status,
        201,
      );


      const deletedC =
        await apiRequest({
          runtime:
            runtime1,

          token,

          method:
            'PATCH',

          path:
            `/v1/trips/${tripC}/lifecycle`,

          body: {
            clientMutationId:
              deleteC,

            expectedRevision:
              0,

            targetStatus:
              'deleted',
          },
        });

      assert.equal(
        deletedC.status,
        200,
      );

      assert.equal(
        deletedC.body
          .data
          .lifecycle
          .status,
        'deleted',
      );


      await stopApi(
        runtime1,
      );

      runtime1 =
        null;


      // ========================================================
      // DATABASE STILL HAS CANONICAL STATE WITH API OFFLINE
      // ========================================================

      const offlineState =
        await auditPool.query(
          `
            SELECT
              id,
              revision,
              lifecycle_status,
              (
                workspace
                  -> 'funds'
                  ->> 'availableNow'
              )::numeric
                AS available_now
            FROM jahiz_trip
            WHERE owner_id = $1
              AND id = ANY($2::text[])
            ORDER BY id ASC
          `,
          [
            ownerId,
            [
              tripA,
              tripB,
              tripC,
            ],
          ],
        );

      assert.deepEqual(
        offlineState.rows.map(
          (row) => [
            row.id,
            Number(
              row.revision,
            ),
            row.lifecycle_status,
            Number(
              row.available_now,
            ),
          ],
        ),
        [
          [
            tripA,
            1,
            'active',
            6100,
          ],
          [
            tripB,
            1,
            'archived',
            5200,
          ],
          [
            tripC,
            1,
            'deleted',
            6300,
          ],
        ],
      );


      const firstRevisionCount =
        await auditPool.query(
          `
            SELECT
              COUNT(*)::int
                AS count
            FROM jahiz_trip_revision
            WHERE trip_id =
              ANY($1::text[])
          `,
          [
            [
              tripA,
              tripB,
              tripC,
            ],
          ],
        );

      assert.equal(
        firstRevisionCount
          .rows[0]
          .count,
        6,
      );


      // ========================================================
      // DEPLOYMENT #2 — REAPPLY MIGRATIONS ON POPULATED DB
      // ========================================================

      runMigrations();

      runtime2 =
        await startApi();


      const session2 =
        await apiRequest({
          runtime:
            runtime2,

          token,

          path:
            '/v1/account/session',
        });

      assert.equal(
        session2.status,
        200,
      );

      assert.equal(
        session2.body
          .data
          .ownerId,
        ownerId,
      );


      const readA2 =
        await apiRequest({
          runtime:
            runtime2,

          token,

          path:
            `/v1/trips/${tripA}`,
        });

      assert.equal(
        readA2.status,
        200,
      );

      assert.equal(
        readA2.body
          .data
          .revision,
        1,
      );

      assert.equal(
        readA2.body
          .data
          .workspace
          .funds
          .availableNow,
        6100,
      );


      const readB2 =
        await apiRequest({
          runtime:
            runtime2,

          token,

          path:
            `/v1/trips/${tripB}`,
        });

      assert.equal(
        readB2.status,
        200,
      );

      assert.equal(
        readB2.body
          .data
          .lifecycle
          .status,
        'archived',
      );


      const readC2 =
        await apiRequest({
          runtime:
            runtime2,

          token,

          path:
            `/v1/trips/${tripC}`,
        });

      assert.equal(
        readC2.status,
        200,
      );

      assert.equal(
        readC2.body
          .data
          .lifecycle
          .status,
        'deleted',
      );


      // Idempotency history itself must survive restart.

      const replayA1 =
        await apiRequest({
          runtime:
            runtime2,

          token,

          method:
            'PUT',

          path:
            `/v1/trips/${tripA}`,

          body: {
            clientMutationId:
              updateA1,

            expectedRevision:
              0,

            workspace:
              workspace(
                tripA,
                6100,
              ),
          },
        });

      assert.equal(
        replayA1.status,
        200,
      );

      assert.equal(
        replayA1.body
          .meta
          .idempotentReplay,
        true,
      );

      assert.equal(
        replayA1.body
          .data
          .revision,
        1,
      );


      const replayArchive =
        await apiRequest({
          runtime:
            runtime2,

          token,

          method:
            'PATCH',

          path:
            `/v1/trips/${tripB}/lifecycle`,

          body: {
            clientMutationId:
              archiveB,

            expectedRevision:
              0,

            targetStatus:
              'archived',
          },
        });

      assert.equal(
        replayArchive.status,
        200,
      );

      assert.equal(
        replayArchive.body
          .meta
          .idempotentReplay,
        true,
      );


      const replayDelete =
        await apiRequest({
          runtime:
            runtime2,

          token,

          method:
            'PATCH',

          path:
            `/v1/trips/${tripC}/lifecycle`,

          body: {
            clientMutationId:
              deleteC,

            expectedRevision:
              0,

            targetStatus:
              'deleted',
          },
        });

      assert.equal(
        replayDelete.status,
        200,
      );

      assert.equal(
        replayDelete.body
          .meta
          .idempotentReplay,
        true,
      );


      // Continue from persisted revision, never restart at zero.

      const updatedA2 =
        await apiRequest({
          runtime:
            runtime2,

          token,

          method:
            'PUT',

          path:
            `/v1/trips/${tripA}`,

          body: {
            clientMutationId:
              updateA2,

            expectedRevision:
              1,

            workspace:
              workspace(
                tripA,
                7200,
              ),
          },
        });

      assert.equal(
        updatedA2.status,
        200,
      );

      assert.equal(
        updatedA2.body
          .data
          .revision,
        2,
      );

      assert.equal(
        updatedA2.body
          .data
          .workspace
          .funds
          .availableNow,
        7200,
      );


      await stopApi(
        runtime2,
      );

      runtime2 =
        null;


      // ========================================================
      // DEPLOYMENT #3 — ANOTHER MIGRATION PASS + FRESH PROCESS
      // ========================================================

      runMigrations();

      runtime3 =
        await startApi();


      const session3 =
        await apiRequest({
          runtime:
            runtime3,

          token,

          path:
            '/v1/account/session',
        });

      assert.equal(
        session3.status,
        200,
      );

      assert.equal(
        session3.body
          .data
          .ownerId,
        ownerId,
      );


      const finalPortfolio =
        await apiRequest({
          runtime:
            runtime3,

          token,

          path:
            '/v1/trips?status=all',
        });

      assert.equal(
        finalPortfolio.status,
        200,
      );

      const finalById =
        new Map(
          finalPortfolio.body
            .data
            .map(
              (trip) => [
                trip.tripId,
                trip,
              ],
            ),
        );

      assert.equal(
        finalById.size,
        3,
      );


      const finalA =
        finalById.get(
          tripA,
        );

      const finalB =
        finalById.get(
          tripB,
        );

      const finalC =
        finalById.get(
          tripC,
        );

      assert.ok(
        finalA,
      );

      assert.ok(
        finalB,
      );

      assert.ok(
        finalC,
      );

      assert.equal(
        finalA.revision,
        2,
      );

      assert.equal(
        finalA.lifecycle.status,
        'active',
      );

      assert.equal(
        finalA.workspace
          .funds
          .availableNow,
        7200,
      );

      assert.equal(
        finalB.revision,
        1,
      );

      assert.equal(
        finalB.lifecycle.status,
        'archived',
      );

      assert.equal(
        finalC.revision,
        1,
      );

      assert.equal(
        finalC.lifecycle.status,
        'deleted',
      );


      // Historical replay after canonical advancement must
      // return the current server truth, even after restart.

      const staleHistoricalReplay =
        await apiRequest({
          runtime:
            runtime3,

          token,

          method:
            'PUT',

          path:
            `/v1/trips/${tripA}`,

          body: {
            clientMutationId:
              updateA1,

            expectedRevision:
              0,

            workspace:
              workspace(
                tripA,
                6100,
              ),
          },
        });

      assert.equal(
        staleHistoricalReplay.status,
        409,
      );

      assert.equal(
        staleHistoricalReplay.body
          .trip
          .revision,
        2,
      );

      assert.equal(
        staleHistoricalReplay.body
          .trip
          .workspace
          .funds
          .availableNow,
        7200,
      );


      await stopApi(
        runtime3,
      );

      runtime3 =
        null;


      // ========================================================
      // FINAL DATABASE HISTORY AUDIT
      // ========================================================

      const finalHistory =
        await auditPool.query(
          `
            SELECT
              trip_id,
              revision,
              mutation_kind
            FROM jahiz_trip_revision
            WHERE trip_id =
              ANY($1::text[])
            ORDER BY
              trip_id ASC,
              revision ASC
          `,
          [
            [
              tripA,
              tripB,
              tripC,
            ],
          ],
        );

      assert.deepEqual(
        finalHistory.rows.map(
          (row) => [
            row.trip_id,
            Number(
              row.revision,
            ),
            row.mutation_kind,
          ],
        ),
        [
          [
            tripA,
            0,
            'create',
          ],
          [
            tripA,
            1,
            'workspace',
          ],
          [
            tripA,
            2,
            'workspace',
          ],
          [
            tripB,
            0,
            'create',
          ],
          [
            tripB,
            1,
            'lifecycle',
          ],
          [
            tripC,
            0,
            'create',
          ],
          [
            tripC,
            1,
            'lifecycle',
          ],
        ],
      );
    }
    finally {

      await Promise.allSettled([
        stopApi(
          runtime1,
        ),
        stopApi(
          runtime2,
        ),
        stopApi(
          runtime3,
        ),
      ]);


      if (ownerId) {
        await auditPool.query(
          `
            DELETE FROM jahiz_trip
            WHERE owner_id = $1
          `,
          [
            ownerId,
          ],
        );

        await auditPool.query(
          `
            DELETE FROM jahiz_user
            WHERE id = $1
          `,
          [
            ownerId,
          ],
        );
      }

      await auditPool.end();
    }
  },
);
