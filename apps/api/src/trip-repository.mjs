function lifecycleFromRow(row) {
  if (
    row.lifecycle_status ===
    'deleted'
  ) {
    return {
      status: 'deleted',
      archivedAt: null,
      deletedAt:
        new Date(
          row.deleted_at,
        ).toISOString(),
    };
  }

  return {
    status:
      row.lifecycle_status,
    archivedAt:
      row.archived_at
        ? new Date(
            row.archived_at,
          ).toISOString()
        : null,
  };
}

function rowToEnvelope(row) {
  return {
    tripId: row.id,
    ownerId: row.owner_id,
    revision: Number(row.revision),
    lifecycle:
      lifecycleFromRow(row),
    workspace: row.workspace,
    serverUpdatedAt:
      new Date(row.updated_at).toISOString(),
  };
}

function revisionRowToEnvelope(row) {
  return {
    tripId: row.trip_id,
    ownerId: row.owner_id,
    revision: Number(row.revision),
    lifecycle:
      lifecycleFromRow(row),
    workspace: row.workspace,
    serverUpdatedAt:
      new Date(row.created_at).toISOString(),
  };
}

function lifecycleRowToEnvelope(row) {
  return rowToEnvelope(row);
}

function lifecycleRevisionRowToEnvelope(row) {
  return revisionRowToEnvelope(row);
}

export function createTripRepository(pool) {
  async function readCurrentTrip(
    client,
    ownerId,
    tripId,
  ) {
    const result =
      await client.query(
        `
          SELECT
            id,
            owner_id,
            revision,
            lifecycle_status,
            archived_at,
            deleted_at,
            workspace,
            updated_at
          FROM jahiz_trip
          WHERE id = $1
            AND owner_id = $2
        `,
        [
          tripId,
          ownerId,
        ],
      );

    return result.rows[0]
      ? rowToEnvelope(
          result.rows[0],
        )
      : null;
  }

  async function listTrips(
    ownerId,
    lifecycleStatus = 'active',
  ) {
    if (
      lifecycleStatus !== 'active' &&
      lifecycleStatus !== 'archived' &&
      lifecycleStatus !== 'deleted' &&
      lifecycleStatus !== 'all'
    ) {
      throw new Error(
        'Unsupported trip lifecycle filter.',
      );
    }

    const result =
      await pool.query(
        `
          SELECT
            id,
            owner_id,
            revision,
            lifecycle_status,
            archived_at,
            deleted_at,
            workspace,
            updated_at
          FROM jahiz_trip
          WHERE owner_id = $1
            AND (
              $2::text = 'all'
              OR lifecycle_status = $2::text
            )
          ORDER BY
            updated_at DESC,
            id ASC
        `,
        [
          ownerId,
          lifecycleStatus,
        ],
      );

    return result.rows.map(
      rowToEnvelope,
    );
  }

  async function getTrip(
    ownerId,
    tripId,
  ) {
    const result = await pool.query(
      `
        SELECT
          id,
          owner_id,
          revision,
          lifecycle_status,
          archived_at,
          deleted_at,
          workspace,
          updated_at
        FROM jahiz_trip
        WHERE id = $1
          AND owner_id = $2
      `,
      [tripId, ownerId],
    );

    return result.rows[0]
      ? rowToEnvelope(result.rows[0])
      : null;
  }

  async function createTrip({
    ownerId,
    clientMutationId,
    workspace,
    serverUpdatedAt = new Date(),
  }) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const existingMutation =
        await client.query(
          `
            SELECT
              r.trip_id,
              t.owner_id,
              r.revision,
              r.mutation_kind,
              r.lifecycle_status,
              r.archived_at,
              r.deleted_at,
              r.workspace,
              r.created_at,
              (
                r.mutation_kind = 'create'
                AND r.revision = 0
                AND r.workspace = $4::jsonb
              ) AS request_matches
            FROM jahiz_trip_revision r
            JOIN jahiz_trip t
              ON t.id = r.trip_id
            WHERE r.trip_id = $1
              AND t.owner_id = $2
              AND r.client_mutation_id = $3
          `,
          [
            workspace.id,
            ownerId,
            clientMutationId,
            JSON.stringify(
              workspace,
            ),
          ],
        );

      if (existingMutation.rows[0]) {
        const current =
          await readCurrentTrip(
            client,
            ownerId,
            workspace.id,
          );

        if (
          existingMutation.rows[0]
            .request_matches &&
          current &&
          current.revision ===
            Number(
              existingMutation.rows[0]
                .revision,
            )
        ) {
          await client.query('COMMIT');

          return {
            status: 'applied',
            trip: revisionRowToEnvelope(
              existingMutation.rows[0],
            ),
            idempotentReplay: true,
          };
        }

        await client.query('COMMIT');

        return {
          status: 'conflict',
          trip: current,
        };
      }

      const inserted = await client.query(
        `
          INSERT INTO jahiz_trip (
            id,
            owner_id,
            revision,
            workspace,
            created_at,
            updated_at
          )
          VALUES ($1, $2, 0, $3::jsonb, $4, $4)
          ON CONFLICT (id) DO NOTHING
          RETURNING
            id,
            owner_id,
            revision,
            lifecycle_status,
            archived_at,
            deleted_at,
            workspace,
            updated_at
        `,
        [
          workspace.id,
          ownerId,
          JSON.stringify(workspace),
          serverUpdatedAt,
        ],
      );

      if (!inserted.rows[0]) {
        const current = await client.query(
          `
            SELECT
              id,
              owner_id,
              revision,
              lifecycle_status,
              archived_at,
              deleted_at,
              workspace,
              updated_at
            FROM jahiz_trip
            WHERE id = $1
              AND owner_id = $2
          `,
          [workspace.id, ownerId],
        );

        await client.query('COMMIT');

        return {
          status: 'conflict',
          trip: current.rows[0]
            ? rowToEnvelope(current.rows[0])
            : null,
        };
      }

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
            workspace,
            created_at
          )
          VALUES (
            $1,
            0,
            $2,
            'mobile',
            'create',
            'active',
            NULL,
            $3::jsonb,
            $4
          )
        `,
        [
          workspace.id,
          clientMutationId,
          JSON.stringify(workspace),
          serverUpdatedAt,
        ],
      );

      await client.query('COMMIT');

      return {
        status: 'applied',
        trip: rowToEnvelope(
          inserted.rows[0],
        ),
        idempotentReplay: false,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function updateTrip({
    ownerId,
    tripId,
    expectedRevision,
    clientMutationId,
    workspace,
    serverUpdatedAt = new Date(),
  }) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const replay = await client.query(
        `
          SELECT
            r.trip_id,
            t.owner_id,
            r.revision,
            r.mutation_kind,
            r.lifecycle_status,
            r.archived_at,
            r.deleted_at,
            r.workspace,
            r.created_at,
            (
              r.mutation_kind = 'workspace'
              AND r.revision =
                ($4::bigint + 1)
              AND r.workspace =
                $5::jsonb
            ) AS request_matches
          FROM jahiz_trip_revision r
          JOIN jahiz_trip t
            ON t.id = r.trip_id
          WHERE r.trip_id = $1
            AND t.owner_id = $2
            AND r.client_mutation_id = $3
        `,
        [
          tripId,
          ownerId,
          clientMutationId,
          expectedRevision,
          JSON.stringify(
            workspace,
          ),
        ],
      );

      if (replay.rows[0]) {
        const current =
          await readCurrentTrip(
            client,
            ownerId,
            tripId,
          );

        if (
          replay.rows[0]
            .request_matches &&
          current &&
          current.revision ===
            Number(
              replay.rows[0]
                .revision,
            )
        ) {
          await client.query('COMMIT');

          return {
            status: 'applied',
            trip: revisionRowToEnvelope(
              replay.rows[0],
            ),
            idempotentReplay: true,
          };
        }

        await client.query('COMMIT');

        return {
          status: 'conflict',
          expectedRevision,
          trip: current,
        };
      }

      const updated = await client.query(
        `
          UPDATE jahiz_trip
          SET
            revision = revision + 1,
            workspace = $4::jsonb,
            updated_at = $5
          WHERE id = $1
            AND owner_id = $2
            AND revision = $3
            AND lifecycle_status = 'active'
          RETURNING
            id,
            owner_id,
            revision,
            lifecycle_status,
            archived_at,
            deleted_at,
            workspace,
            updated_at
        `,
        [
          tripId,
          ownerId,
          expectedRevision,
          JSON.stringify(workspace),
          serverUpdatedAt,
        ],
      );

      if (!updated.rows[0]) {
        const current = await client.query(
          `
            SELECT
              id,
              owner_id,
              revision,
              lifecycle_status,
              archived_at,
              deleted_at,
              workspace,
              updated_at
            FROM jahiz_trip
            WHERE id = $1
              AND owner_id = $2
          `,
          [tripId, ownerId],
        );

        await client.query('COMMIT');

        return {
          status: 'conflict',
          expectedRevision,
          trip: current.rows[0]
            ? rowToEnvelope(current.rows[0])
            : null,
        };
      }

      const envelope = rowToEnvelope(
        updated.rows[0],
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
            workspace,
            created_at
          )
          VALUES (
            $1,
            $2,
            $3,
            'mobile',
            'workspace',
            'active',
            NULL,
            $4::jsonb,
            $5
          )
        `,
        [
          tripId,
          envelope.revision,
          clientMutationId,
          JSON.stringify(workspace),
          serverUpdatedAt,
        ],
      );

      await client.query('COMMIT');

      return {
        status: 'applied',
        trip: envelope,
        idempotentReplay: false,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function transitionTripLifecycle({
    ownerId,
    tripId,
    expectedRevision,
    clientMutationId,
    targetStatus,
    serverUpdatedAt = new Date(),
  }) {
    if (
      targetStatus !== 'active' &&
      targetStatus !== 'archived' &&
      targetStatus !== 'deleted'
    ) {
      throw new Error(
        'Unsupported trip lifecycle status.',
      );
    }

    const client =
      await pool.connect();

    try {
      await client.query('BEGIN');

      const replay =
        await client.query(
          `
            SELECT
              r.trip_id,
              t.owner_id,
              r.revision,
              r.mutation_kind,
              r.lifecycle_status,
              r.archived_at,
              r.deleted_at,
              r.workspace,
              r.created_at,
              (
                r.mutation_kind = 'lifecycle'
                AND r.revision =
                  ($4::bigint + 1)
                AND r.lifecycle_status =
                  $5::text
              ) AS request_matches
            FROM jahiz_trip_revision r
            JOIN jahiz_trip t
              ON t.id = r.trip_id
            WHERE r.trip_id = $1
              AND t.owner_id = $2
              AND r.client_mutation_id = $3
          `,
          [
            tripId,
            ownerId,
            clientMutationId,
            expectedRevision,
            targetStatus,
          ],
        );

      if (replay.rows[0]) {
        const current =
          await readCurrentTrip(
            client,
            ownerId,
            tripId,
          );

        if (
          replay.rows[0]
            .request_matches &&
          current &&
          current.revision ===
            Number(
              replay.rows[0]
                .revision,
            )
        ) {
          await client.query('COMMIT');

          return {
            status: 'applied',
            trip:
              lifecycleRevisionRowToEnvelope(
                replay.rows[0],
              ),
            idempotentReplay: true,
          };
        }

        await client.query('COMMIT');

        return {
          status: 'conflict',
          expectedRevision,
          trip: current,
        };
      }

      const currentBefore =
        await client.query(
          `
            SELECT
              id,
              owner_id,
              revision,
              lifecycle_status,
              archived_at,
              deleted_at,
              workspace,
              updated_at
            FROM jahiz_trip
            WHERE id = $1
              AND owner_id = $2
          `,
          [
            tripId,
            ownerId,
          ],
        );

      if (!currentBefore.rows[0]) {
        await client.query('COMMIT');

        return {
          status: 'conflict',
          expectedRevision,
          trip: null,
        };
      }

      const currentTrip =
        lifecycleRowToEnvelope(
          currentBefore.rows[0],
        );

      if (
        currentTrip.revision !==
        expectedRevision
      ) {
        await client.query('COMMIT');

        return {
          status: 'conflict',
          expectedRevision,
          trip: currentTrip,
        };
      }

      if (
        currentTrip.lifecycle.status ===
          'deleted' ||
        currentTrip.lifecycle.status ===
          targetStatus
      ) {
        await client.query('COMMIT');

        return {
          status:
            'invalid_transition',
          trip:
            currentTrip,
        };
      }

      const updated =
        await client.query(
          `
            UPDATE jahiz_trip
            SET
              revision = revision + 1,
              lifecycle_status = $4,
              archived_at =
                CASE
                  WHEN $4 = 'archived'
                    THEN $5::timestamptz
                  ELSE NULL::timestamptz
                END,
              deleted_at =
                CASE
                  WHEN $4 = 'deleted'
                    THEN $5::timestamptz
                  ELSE NULL::timestamptz
                END,
              updated_at = $5::timestamptz
            WHERE id = $1
              AND owner_id = $2
              AND revision = $3
              AND lifecycle_status <> 'deleted'
              AND lifecycle_status <> $4
            RETURNING
              id,
              owner_id,
              revision,
              lifecycle_status,
              archived_at,
              deleted_at,
              workspace,
              updated_at
          `,
          [
            tripId,
            ownerId,
            expectedRevision,
            targetStatus,
            serverUpdatedAt,
          ],
        );

      if (!updated.rows[0]) {
        const current =
          await client.query(
            `
              SELECT
                id,
                owner_id,
                revision,
                lifecycle_status,
                archived_at,
                deleted_at,
                workspace,
                updated_at
              FROM jahiz_trip
              WHERE id = $1
                AND owner_id = $2
            `,
            [
              tripId,
              ownerId,
            ],
          );

        await client.query('COMMIT');

        if (!current.rows[0]) {
          return {
            status: 'conflict',
            expectedRevision,
            trip: null,
          };
        }

        const canonical =
          lifecycleRowToEnvelope(
            current.rows[0],
          );

        if (
          canonical.revision !==
          expectedRevision
        ) {
          return {
            status: 'conflict',
            expectedRevision,
            trip: canonical,
          };
        }

        return {
          status:
            'invalid_transition',
          trip:
            canonical,
        };
      }

      const envelope =
        lifecycleRowToEnvelope(
          updated.rows[0],
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
            workspace,
            created_at
          )
          VALUES (
            $1,
            $2,
            $3,
            'mobile',
            'lifecycle',
            $4,
            $5::timestamptz,
            $6::timestamptz,
            $7::jsonb,
            $8::timestamptz
          )
        `,
        [
          tripId,
          envelope.revision,
          clientMutationId,
          envelope.lifecycle.status,
          envelope.lifecycle.archivedAt,
          envelope.lifecycle.deletedAt ?? null,
          JSON.stringify(
            envelope.workspace,
          ),
          serverUpdatedAt,
        ],
      );

      await client.query('COMMIT');

      return {
        status: 'applied',
        trip: envelope,
        idempotentReplay: false,
      };
    }
    catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    finally {
      client.release();
    }
  }
  return {
    listTrips,
    getTrip,
    createTrip,
    updateTrip,
    transitionTripLifecycle,
  };
}
