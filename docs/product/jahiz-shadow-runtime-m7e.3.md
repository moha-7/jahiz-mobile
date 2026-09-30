# Jahiz M7E.3 — Controlled Shadow Runtime Controller

## Goal

Add the runtime control layer needed before any real mobile-store wiring.

The active trip store remains local-authoritative and is **not subscribed** by this milestone.

## New runtime responsibilities

### Feature gate

When disabled:

- no cursor read
- no network request
- no telemetry
- no mutation

### Persisted cursor

A per-trip shadow cursor is persisted through an abstract storage adapter.

The mobile adapter uses Expo SecureStore.

Persisted data contains only:

- server revision
- last mirrored local `updatedAt`
- last server `updatedAt`

No financial payload is stored in the cursor.

### One-flight

Only one shadow sync for the same trip may execute at a time.

Concurrent callers receive the same in-flight promise.

Different trips remain independent.

### Retry

Only transport unavailability is retried.

The same `clientMutationId` is reused across retries so a lost acknowledgement converges through server idempotency.

The controller does **not** retry:

- unauthorized
- invalid response
- conflict
- divergence

### Telemetry

A telemetry sink is injected.

Before emission, every event passes the privacy-safety guard introduced in M7E.1.

### Authority

The runtime controller never writes the canonical local workspace.

Conflicts and divergence remain observations.


## Node test resolution boundary

Expo/Metro intentionally supports the mobile project's extensionless relative TypeScript imports.

Node 22 native ESM does not resolve an extensionless import such as `./jahiz-shadow-sync` to `./jahiz-shadow-sync.ts`, even when `--experimental-strip-types` is enabled.

M7E.3.1 therefore adds a **test-only Node resolver loader**. It activates only after a relative extensionless import fails, then tries `.ts` and `.tsx`.

Production mobile imports and the Expo TypeScript configuration remain unchanged.

## Still intentionally absent

- Zustand subscription
- app-start auto sync
- background task
- production identity provider
- server-to-local overwrite
- server-authoritative cutover

## Next

M7E.4 can wire the controller behind an explicit runtime flag and explicit user/session auth provider.

That wiring should start in **observe-only** mode and collect parity evidence before enabling any authority change.
