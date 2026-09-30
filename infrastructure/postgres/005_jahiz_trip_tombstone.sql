-- Jahiz M9.3C.1 — Deleted trip tombstone foundation.
--
-- Deleted trips remain as canonical server records so stale clients cannot
-- silently recreate them during later multi-device synchronization.
--
-- No workspace is physically deleted by this migration.
-- A deleted lifecycle is terminal at the domain layer.

BEGIN;

ALTER TABLE jahiz_trip
  ADD COLUMN IF NOT EXISTS deleted_at
    TIMESTAMPTZ;

ALTER TABLE jahiz_trip_revision
  ADD COLUMN IF NOT EXISTS deleted_at
    TIMESTAMPTZ;


-- Replace M9.3A lifecycle invariants with the complete
-- active / archived / deleted state machine.

ALTER TABLE jahiz_trip
  DROP CONSTRAINT IF EXISTS
    jahiz_trip_lifecycle_check;

ALTER TABLE jahiz_trip
  ADD CONSTRAINT
    jahiz_trip_lifecycle_check
  CHECK (
    (
      lifecycle_status = 'active'
      AND archived_at IS NULL
      AND deleted_at IS NULL
    )
    OR
    (
      lifecycle_status = 'archived'
      AND archived_at IS NOT NULL
      AND deleted_at IS NULL
    )
    OR
    (
      lifecycle_status = 'deleted'
      AND archived_at IS NULL
      AND deleted_at IS NOT NULL
    )
  );


ALTER TABLE jahiz_trip_revision
  DROP CONSTRAINT IF EXISTS
    jahiz_trip_revision_lifecycle_check;

ALTER TABLE jahiz_trip_revision
  ADD CONSTRAINT
    jahiz_trip_revision_lifecycle_check
  CHECK (
    (
      lifecycle_status = 'active'
      AND archived_at IS NULL
      AND deleted_at IS NULL
    )
    OR
    (
      lifecycle_status = 'archived'
      AND archived_at IS NOT NULL
      AND deleted_at IS NULL
    )
    OR
    (
      lifecycle_status = 'deleted'
      AND archived_at IS NULL
      AND deleted_at IS NOT NULL
    )
  );

COMMIT;
