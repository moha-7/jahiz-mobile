-- Jahiz M9.4B.1 — Mutation identity integrity.
--
-- client_mutation_id remains globally unique per trip.
-- mutation_kind records which operation originally consumed that id so a
-- different operation can never be mistaken for an idempotent replay.
--
-- Existing history is classified deterministically:
--   revision 0                         -> create
--   lifecycle metadata changed        -> lifecycle
--   otherwise                         -> workspace

BEGIN;

ALTER TABLE jahiz_trip_revision
  ADD COLUMN IF NOT EXISTS
    mutation_kind TEXT;

WITH history AS (
  SELECT
    trip_id,
    revision,
    lifecycle_status,
    archived_at,
    deleted_at,

    LAG(revision) OVER (
      PARTITION BY trip_id
      ORDER BY revision
    ) AS previous_revision,

    LAG(lifecycle_status) OVER (
      PARTITION BY trip_id
      ORDER BY revision
    ) AS previous_lifecycle_status,

    LAG(archived_at) OVER (
      PARTITION BY trip_id
      ORDER BY revision
    ) AS previous_archived_at,

    LAG(deleted_at) OVER (
      PARTITION BY trip_id
      ORDER BY revision
    ) AS previous_deleted_at

  FROM jahiz_trip_revision
),

classified AS (
  SELECT
    trip_id,
    revision,

    CASE
      WHEN revision = 0
        THEN 'create'

      WHEN previous_revision IS NULL
        THEN 'workspace'

      WHEN
        lifecycle_status
          IS DISTINCT FROM
        previous_lifecycle_status
        OR
        archived_at
          IS DISTINCT FROM
        previous_archived_at
        OR
        deleted_at
          IS DISTINCT FROM
        previous_deleted_at
        THEN 'lifecycle'

      ELSE 'workspace'
    END AS mutation_kind

  FROM history
)

UPDATE jahiz_trip_revision r
SET mutation_kind =
  classified.mutation_kind
FROM classified
WHERE r.trip_id =
      classified.trip_id
  AND r.revision =
      classified.revision
  AND r.mutation_kind IS NULL;


ALTER TABLE jahiz_trip_revision
  ALTER COLUMN mutation_kind
  SET NOT NULL;


DO $jahiz_mutation_kind_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'jahiz_trip_revision_mutation_kind_check'
      AND conrelid =
        'jahiz_trip_revision'::regclass
  ) THEN
    ALTER TABLE jahiz_trip_revision
      ADD CONSTRAINT
        jahiz_trip_revision_mutation_kind_check
      CHECK (
        mutation_kind IN (
          'create',
          'workspace',
          'lifecycle'
        )
      );
  END IF;
END
$jahiz_mutation_kind_check$;


CREATE INDEX IF NOT EXISTS
  jahiz_trip_revision_mutation_kind_idx
ON jahiz_trip_revision (
  trip_id,
  mutation_kind,
  client_mutation_id
);

COMMIT;
