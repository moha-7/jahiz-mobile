-- Jahiz M9.3A — Canonical trip lifecycle foundation.
--
-- Lifecycle is server-owned metadata outside the client workspace document.
-- Archive / restore transitions participate in the same optimistic revision
-- sequence as normal workspace mutations.
--
-- Deleted tombstones are intentionally deferred to M9.3C.

BEGIN;

ALTER TABLE jahiz_trip
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT
    NOT NULL
    DEFAULT 'active';

ALTER TABLE jahiz_trip
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE jahiz_trip_revision
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT
    NOT NULL
    DEFAULT 'active';

ALTER TABLE jahiz_trip_revision
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

DO $jahiz_trip_lifecycle_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'jahiz_trip_lifecycle_check'
      AND conrelid =
        'jahiz_trip'::regclass
  ) THEN
    ALTER TABLE jahiz_trip
      ADD CONSTRAINT jahiz_trip_lifecycle_check
      CHECK (
        (
          lifecycle_status = 'active'
          AND archived_at IS NULL
        )
        OR
        (
          lifecycle_status = 'archived'
          AND archived_at IS NOT NULL
        )
      );
  END IF;
END
$jahiz_trip_lifecycle_check$;

DO $jahiz_trip_revision_lifecycle_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'jahiz_trip_revision_lifecycle_check'
      AND conrelid =
        'jahiz_trip_revision'::regclass
  ) THEN
    ALTER TABLE jahiz_trip_revision
      ADD CONSTRAINT jahiz_trip_revision_lifecycle_check
      CHECK (
        (
          lifecycle_status = 'active'
          AND archived_at IS NULL
        )
        OR
        (
          lifecycle_status = 'archived'
          AND archived_at IS NOT NULL
        )
      );
  END IF;
END
$jahiz_trip_revision_lifecycle_check$;

CREATE INDEX IF NOT EXISTS
  jahiz_trip_owner_lifecycle_updated_idx
ON jahiz_trip (
  owner_id,
  lifecycle_status,
  updated_at DESC,
  id ASC
);

COMMIT;
