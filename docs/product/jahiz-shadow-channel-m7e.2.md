# Jahiz M7E.2 — Controlled End-to-End Shadow Channel

## Purpose

M7E.2 proves the complete shadow path across a real TCP socket and a real PostgreSQL database while keeping the active mobile store untouched.

```text
Shadow State Machine
  ↓
Mobile HTTP Transport
  ↓
Real TCP Socket
  ↓
Fastify BFF
  ↓
Development/Test Auth Boundary
  ↓
Owner-scoped Repository
  ↓
PostgreSQL
```

## Proven flows

- first shadow create
- unchanged no-op
- CAS update
- lost acknowledgement replay / idempotency
- real concurrent server conflict
- bootstrap divergence
- privacy-safe telemetry
- unauthorized access failure

## Authority rule

Local mobile state is still authoritative.

The end-to-end channel is test-controlled only. It is not subscribed to Zustand, background tasks, app startup, or user actions.

## Why this phase exists

Unit tests proved the shadow state machine.

M7D proved the BFF.

M7C proved the repository.

M7E.2 proves that all of those pieces compose correctly over the actual network boundary.

Only after this passes should Jahiz wire a runtime controller to the mobile store.

## Next step

M7E.3 should add a controlled runtime controller with:

- persisted per-trip shadow cursor
- explicit feature flag
- explicit authentication token provider
- debounce / one-flight behavior
- retry/backoff
- telemetry sink abstraction
- no local overwrite from server

The cutover to server authority remains a later milestone.
