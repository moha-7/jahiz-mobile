# Jahiz M7F.1 — Parity Evidence + Cutover Review Gate

## Goal

Turn observe-only shadow sync into measurable migration evidence without changing authority.

The mobile workspace remains the source of truth.

## Evidence model

The evidence store records only aggregate operational facts:

- session count
- observation count
- parity same / different / unknown
- conflicts
- bootstrap divergence
- server divergence
- unavailable outcomes
- unauthorized outcomes
- invalid responses
- outcome counts
- first / last observation timestamp

It stores no workspace, route, destination, funds, reserve, costs, commitments, payments, or Money In.

## Persistence

Evidence is persisted locally through Expo SecureStore.

The store serializes concurrent writes so observations from different trips cannot lose increments through read/modify/write races.

## Human review gate

The default review policy is intentionally conservative:

- at least 3 observe sessions
- at least 25 observations
- parity-same rate at least 99%
- conflict rate at most 1%
- unavailable rate at most 5%
- zero bootstrap divergence
- zero server divergence
- zero invalid responses
- zero unauthorized outcomes

Passing the policy returns:

`eligible-for-review`

It never returns an automatic server-authoritative cutover decision.

## Why review, not automatic promotion

A clean technical shadow run is necessary but not sufficient for migration.

Before authority changes we still need:

- real-device sessions
- production identity strategy
- account/bootstrap migration behavior
- operational rollback plan
- outage behavior
- release sequencing

## Development visibility

When observe-only mode is enabled, Jahiz records the aggregate evidence locally and may log only the privacy-safe aggregate snapshot in development.

The development log never includes financial or trip payload data.

## Next

M7F.2 should run a real-device parity acceptance flow and expose a temporary development-only diagnostics surface for reviewing the aggregate evidence and cutover blockers.

Server authority remains off.
