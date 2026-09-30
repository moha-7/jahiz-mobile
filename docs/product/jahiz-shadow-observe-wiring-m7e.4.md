# Jahiz M7E.4 — Explicit Observe-Only Mobile Wiring

## Goal

Wire the already-proven shadow runtime into the real mobile provider tree without changing authority.

The wiring is **disabled by default**.

## Runtime gate

Observe mode requires all of the following:

- development build
- native platform (`ios` or `android`)
- `EXPO_PUBLIC_JAHIZ_SHADOW_OBSERVE=1`
- `EXPO_PUBLIC_JAHIZ_SHADOW_API_URL`
- `EXPO_PUBLIC_JAHIZ_SHADOW_DEV_OWNER`

Production is always disabled by this milestone.

Web is disabled because the current cursor adapter intentionally uses Expo SecureStore.

## Provider wiring

`AppProviders` mounts one invisible `JahizShadowSyncObserver`.

The observer reads:

- active `workspace`
- `hasHydrated`

from the existing Zustand workspace store.

It never calls a workspace setter.

## Change flow

```text
Hydrated local workspace
  ↓
750 ms observe-only debounce
  ↓
latest-only queue
  ↓
Shadow Runtime Controller
  ↓
HTTP Transport
  ↓
BFF / Auth / Repository / PostgreSQL
```

If a local change arrives while a sync is running, the queue preserves the latest trailing state and runs it after the current attempt finishes.

Intermediate rapid edits are intentionally collapsed.

## Authority invariant

Server data is never applied to Zustand.

Conflict and divergence remain observations only.

Local workspace continues to drive Today, Plan, Moves, and Payments.

## Development authentication

The temporary mobile observe channel uses the existing development-only BFF bearer form:

`Bearer dev:<owner>`

The owner value is an identifier, not a secret.

The BFF already blocks development authentication in production.

This milestone does not select the production identity provider.

## What remains before server-authoritative cutover

- production authentication
- durable telemetry backend
- real-device parity sessions
- conflict-rate observation
- retry/outage observation
- explicit cutover policy
- server bootstrap policy for existing local users

M7F should focus on **parity evidence + migration/cutover policy**, not immediately replace local truth.
