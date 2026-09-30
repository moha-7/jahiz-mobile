-- Jahiz M9.2B — Trip owner integrity cutover.
--
-- Every persisted trip must belong to a stable internal Jahiz user.
-- Provider subjects and development bearer subjects are not ownership
-- authority.
--
-- Safety:
-- - Existing orphan trips fail the migration.
-- - No automatic reassignment.
-- - No automatic deletion.
-- - A user cannot be deleted while trips still reference it.

BEGIN;

DO $jahiz_owner_guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM jahiz_trip t
    LEFT JOIN jahiz_user u
      ON u.id = t.owner_id
    WHERE u.id IS NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE =
        'Cannot enforce Jahiz trip ownership: orphan trip owners exist.';
  END IF;
END
$jahiz_owner_guard$;

DO $jahiz_owner_fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'jahiz_trip_owner_user_fk'
      AND conrelid =
        'jahiz_trip'::regclass
  ) THEN
    ALTER TABLE jahiz_trip
      ADD CONSTRAINT jahiz_trip_owner_user_fk
      FOREIGN KEY (owner_id)
      REFERENCES jahiz_user(id)
      ON DELETE RESTRICT;
  END IF;
END
$jahiz_owner_fk$;

COMMIT;
