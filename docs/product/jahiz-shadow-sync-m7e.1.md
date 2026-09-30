# Jahiz M7E.1 — Mobile Shadow Sync Foundation

## Goal

Introduce the shadow-sync state machine **without changing mobile authority**.

The local mobile workspace remains authoritative.

The server receives a mirrored copy only when the state machine can do so safely.

## State machine

### First observation

```text
local trip
  ↓
GET server trip
  ├─ 404 → create shadow copy
  ├─ same → record parity + revision cursor
  └─ different → bootstrap divergence
                 do not overwrite either side
```

### Later local mutation

```text
local changed
  +
last known server revision
  ↓
PUT expectedRevision
  ├─ 200 → verify returned server parity
  ├─ 409 → conflict; preserve local authority
  └─ unavailable → preserve cursor and retry later
```

## Cursor

The shadow cursor stores only:

- last known server revision
- local `updatedAt` that was mirrored
- server `updatedAt`

It does not become source of financial truth.

## Telemetry privacy

Parity telemetry contains only:

- outcome
- same/different/unknown parity
- network action
- server revision
- duration

It deliberately excludes:

- workspace payload
- available money
- reserve
- commitments
- payments
- costs
- Money In

## Important safety rule

Bootstrap divergence never silently chooses local or server as the winner.

That decision belongs to a later migration/cutover policy.

## What M7E.1 does not do

- no automatic store subscription
- no background sync task
- no production auth selection
- no local overwrite from server
- no server-authoritative cutover

M7E.2 can wire this state machine to a controlled end-to-end shadow channel after these invariants are green.
