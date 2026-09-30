# Jahiz M7D — HTTP/BFF + Authentication Boundary

## Purpose

M7D adds the network boundary on top of the proven PostgreSQL repository.

It deliberately does **not** switch the mobile app to server authority yet.

## Request path

```text
Mobile / Client
  ↓
HTTP/BFF
  ↓
Authentication verifier
  ↓
Owner-scoped repository
  ↓
PostgreSQL Server Truth
```

## Security invariant

`ownerId` is never accepted as authority from the request body.

The HTTP layer derives owner identity only from the authentication verifier and passes that trusted identity to the repository.

Cross-owner reads and writes return `404` to avoid exposing another user's trip state.

## Production authentication

M7D does not choose a production identity provider.

The server factory requires an injected authentication verifier.

The included development bearer authenticator is explicitly blocked when `NODE_ENV=production`.

This keeps the architecture provider-neutral for a future production choice such as a managed OIDC/JWT provider.

## HTTP routes

- `GET /health`
- `GET /v1/trips/:tripId`
- `POST /v1/trips`
- `PUT /v1/trips/:tripId`

## Concurrency

Updates carry:

- `expectedRevision`
- `clientMutationId`
- validated workspace

A stale update returns HTTP `409` with the canonical server trip.

No last-write-wins behavior is introduced.

## Next migration step

M7E should add **mobile shadow sync**:

1. local workspace remains authoritative,
2. mobile sends a copy to the server,
3. server result is compared with the local workspace,
4. mismatches are observed but do not overwrite local state,
5. only after parity evidence is strong do we cut over to server-authoritative writes.
