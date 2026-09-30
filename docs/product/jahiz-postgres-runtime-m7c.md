# Jahiz M7C — PostgreSQL Repository Runtime

M7C proves the Server Truth model against a real PostgreSQL instance.

## What is now real

- PostgreSQL migration executes against Postgres 16.
- Trip create persists canonical JSONB workspace.
- Trip read is owner-scoped.
- Update uses compare-and-swap revision semantics.
- Stale writes return a conflict instead of overwriting.
- Mutation IDs are idempotent.
- Revision history remains immutable.

## What is intentionally not active yet

The mobile app is still local-authoritative.

M7C does **not** switch the mobile store to the API or database.

The next layer should be an authenticated HTTP/BFF boundary, followed by shadow sync and only then server-authoritative mobile writes.


## Integration-test credential isolation

Repository integration tests do not reuse the development database password.

The installer creates a dedicated temporary/local-only role and database:

- `jahiz_m7c_test`
- random per-run password
- published Docker PostgreSQL port discovered from Compose

This prevents stale Docker volumes, `.env` values, or changed development credentials from being misdiagnosed as repository failures.

The test sequence is deliberately layered:

1. Docker container health
2. container metadata discovery
3. isolated role/database provisioning
4. TCP password-authentication probe
5. repository integration tests
6. full Jahiz regression gates

## Production rule

`ownerId` must come from authenticated server identity.

The repository accepts it as an argument because authentication belongs to the API boundary, not to database payloads.
