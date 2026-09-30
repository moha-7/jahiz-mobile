-- Jahiz M7G.3 - provider-neutral user and identity-link persistence.
--
-- Important:
-- - jahiz_user.id is the stable internal Jahiz owner identifier.
-- - provider_subject is opaque external identity and is never accepted from a
--   client as repository authority.
-- - jahiz_trip.owner_id intentionally remains TEXT without a foreign key in
--   this milestone so development/acceptance identities keep working while the
--   production identity rollout is still controlled.

CREATE TABLE IF NOT EXISTS jahiz_user (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT jahiz_user_id_nonempty
    CHECK (char_length(btrim(id)) BETWEEN 1 AND 160),
  CONSTRAINT jahiz_user_status_valid
    CHECK (status IN ('active', 'disabled', 'deleted'))
);

CREATE TABLE IF NOT EXISTS jahiz_identity_link (
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  user_id TEXT NOT NULL
    REFERENCES jahiz_user(id)
    ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider, provider_subject),
  UNIQUE (user_id, provider),
  CONSTRAINT jahiz_identity_provider_valid
    CHECK (
      char_length(provider) BETWEEN 1 AND 80
      AND provider ~ '^[a-z0-9][a-z0-9._-]*$'
    ),
  CONSTRAINT jahiz_identity_subject_nonempty
    CHECK (
      char_length(btrim(provider_subject))
      BETWEEN 1 AND 255
    )
);

CREATE INDEX IF NOT EXISTS jahiz_identity_user_idx
  ON jahiz_identity_link (user_id);
