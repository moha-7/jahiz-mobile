-- Jahiz M7B — Server Truth foundation
-- PostgreSQL 16+
--
-- The trip document remains canonical as validated JSON at this stage.
-- Normalized market facts and analytics tables arrive in later slices.
--
-- Concurrency rule:
-- UPDATE jahiz_trip
-- SET revision = revision + 1, workspace = $workspace, updated_at = now()
-- WHERE id = $trip_id
--   AND owner_id = $owner_id
--   AND revision = $expected_revision;
--
-- A zero-row update is a conflict, never a silent last-write-wins overwrite.

BEGIN;

CREATE TABLE IF NOT EXISTS jahiz_trip (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  revision BIGINT NOT NULL DEFAULT 0 CHECK (revision >= 0),
  workspace JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jahiz_trip_owner_updated_idx
  ON jahiz_trip (owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS jahiz_trip_revision (
  trip_id TEXT NOT NULL
    REFERENCES jahiz_trip(id)
    ON DELETE CASCADE,
  revision BIGINT NOT NULL CHECK (revision >= 0),
  client_mutation_id TEXT NOT NULL,
  source TEXT NOT NULL
    CHECK (source IN ('mobile', 'server', 'migration')),
  workspace JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, revision),
  UNIQUE (trip_id, client_mutation_id)
);

CREATE INDEX IF NOT EXISTS jahiz_trip_revision_created_idx
  ON jahiz_trip_revision (trip_id, created_at DESC);

COMMIT;
