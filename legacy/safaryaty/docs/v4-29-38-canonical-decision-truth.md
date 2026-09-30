# v4.29.38 — Canonical Decision Truth

## Goal

A draft trip and the same saved trip must return the same readiness score, factor scores and verdict.

## Source of truth

All score and verdict thresholds now live in one pure module:

```txt
shared/decision-engine.js
```

The module receives normalized decision inputs and returns:

```txt
version
readiness
scoreFactors
key
verdict
reasonCode
gap
planned
available
remaining
bufferTarget
```

## Frontend

`src/engine.js` builds the frontend decision input and calls the shared engine.

`src/canTravel.js` no longer owns score/verdict thresholds. It only:

- converts `reasonCode` into user-facing copy;
- chooses the next action and deep link;
- preserves the canonical score and verdict unchanged.

## Backend

`backend/src/modules/finance/cashflow.engine.ts` calls the same shared runtime module for saved-trip summaries.

Backend summaries now return the full canonical `decision` object and `verdict`. The frontend merge adapter uses that decision for saved trips.

## Additional truth fixes found during implementation

- Paid monthly bills are included in the backend Paid card.
- Paid origin commitments are excluded from future available-money deductions.
- Paid installments no longer reduce the destination saving gap twice.
- Backend cashflow timing now includes negative monthly cashflow and the saved trip's `continuesAfterTrip` signal.

## Compatibility

The legacy backend `status` remains for existing UI/API consumers:

```txt
READY -> READY
ALMOST / TIGHT -> TIGHT
BLOCKED / RISKY -> NEEDS_ADJUSTMENT
```

The canonical field is now `decision.verdict`.

## Deployment note

The backend imports `shared/decision-engine.js` from the repository root. Any standalone backend packaging or future Docker image must copy the root `shared/` directory alongside the compiled backend.

## Tests

- canonical decision unit tests;
- canTravel presentation-only tests;
- draft/local vs saved/backend parity for score, factor scores, verdict and reason code;
- all prior calculation, payment, FX and stability tests.

## Verification status

- Frontend/core automated gate: passed.
- Shared backend decision module syntax and import resolution: passed through an esbuild bundle check.
- Full Prisma generation could not run in this sandbox because `binaries.prisma.sh` was unreachable (`EAI_AGAIN`).
- Consequently, `tsc` could not see generated Prisma model exports. This is an environment/download limitation, not a decision-engine syntax failure. Run `npm run prisma:generate && npm run build` in the normal connected development environment before merge.
