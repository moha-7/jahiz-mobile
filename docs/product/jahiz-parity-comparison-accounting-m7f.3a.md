# Jahiz M7F.3A — Comparable Parity Evidence Accounting

## Real-device finding

The physical-device shadow run produced healthy transport/runtime evidence:

- Observe enabled
- local authority preserved
- 3 sessions
- 10 observations
- zero conflicts
- zero unavailable outcomes
- zero bootstrap divergence
- zero server divergence
- zero invalid responses
- zero unauthorized outcomes

The diagnostics screen still showed `Parity same 10%`.

That percentage was misleading because the evidence snapshot divided `paritySame`
by **all observations**. The shadow state machine intentionally emits
`parity: 'unknown'` for events such as `skipped-unchanged`, where no remote
workspace comparison occurs.

Unknown/non-comparable observations must stay visible, but they must not dilute
the success rate of actual local-versus-server comparisons.

## Correct accounting

Derived metrics now use:

- `observations` — every recorded shadow event
- `parityComparisons` — `paritySame + parityDifferent`
- `paritySameRate` — `paritySame / parityComparisons`
- `parityDifferentRate` — `parityDifferent / parityComparisons`
- `parityUnknown` — count of non-comparable observations
- conflict/unavailable rates — still divided by all observations

Persisted evidence remains version 1 because the stored counters do not change.
Only derived review semantics change.

## Conservative review gate

The review gate still requires:

- at least 3 sessions
- at least 25 total observations
- at least 25 comparable parity checks
- at least 99% parity-same among comparable checks
- conflict rate at most 1%
- unavailable rate at most 5%
- zero bootstrap divergence
- zero server divergence
- zero invalid responses
- zero unauthorized outcomes

This prevents 24 unknown observations plus one successful comparison from
qualifying for review.

The result remains `eligible-for-review` only. Server authority is never enabled
automatically.

## Diagnostics

Development diagnostics now distinguish:

- Observations
- Parity checks
- Parity unknown
- Parity same

For the already-persisted real-device evidence, this lets the UI distinguish a
small number of successful comparisons from many skipped/non-comparable events.

## Authority

No sync transport, local workspace, finance logic, persistence authority, or
server-authoritative cutover behavior changes in M7F.3A.
