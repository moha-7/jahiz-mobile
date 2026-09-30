# Jahiz M7B — Server Truth Foundation

## Decision

Jahiz is moving to a **server-authoritative** model.

The mobile workspace can remain available as a resilient cache, but it is no longer the long-term source of truth.

## Sync rule

Every server trip carries a monotonically increasing `revision`.

Mobile update:

```text
GET trip revision 12
↓
edit locally
↓
PUT expectedRevision = 12
↓
server transaction
```

If the current server revision is still 12:

```text
apply
revision = 13
```

If another device already changed it:

```text
server revision = 13
client expected = 12
↓
409 / conflict result
↓
return canonical server trip
```

There is **no silent last-write-wins** behavior.

## Why JSONB first

The current Trip Workspace already has a well-tested domain contract. During the migration to server truth, storing the validated trip document in JSONB reduces migration risk.

Later tables can normalize:

- external market facts
- flight/hotel quotes
- FX snapshots
- recommendation runs
- user actions
- telemetry / model features

without prematurely duplicating every workspace field into relational columns.

## Persistence model

`jahiz_trip`
- canonical current workspace
- owner
- revision
- timestamps

`jahiz_trip_revision`
- immutable revision history
- mutation id for idempotency
- source
- historical workspace

## Security direction

`owner_id` is server-derived from authentication. It must never be trusted from a client payload.

Authentication and authorization are a separate implementation slice before production deployment.

## Mobile migration sequence

1. Server Truth contract
2. PostgreSQL repository
3. authenticated API/BFF
4. mobile pull/bootstrap
5. dual-write shadow validation
6. server-authoritative write path
7. offline queue as fallback
8. remove local-authoritative assumptions

Do not flip the mobile source of truth until server persistence and conflict tests are green.

## Market Data compatibility

The future provider layer stores fresh/stale/expired facts separately from the canonical user trip.

```text
User Trip Truth
+
Market Truth
↓
Scenario Engine
↓
Jahiz Moves
```

Unknown external data remains Unknown. It never becomes zero.
