# v4.29.6 — Payments Truth + Date Consistency

## Scope

Small stability pass on top of v4.29.5.

## Changes

- Replaced native browser date display with a consistent text date control.
- All visible date fields now use `YYYY-MM-DD` format.
- Date fields accept common typed formats and normalize on blur.
- Start/end trip dates, income dates, repeat dates, salary advanced date, and payment date displays are normalized.
- Saved trip Payments remain backend-first.
- Draft/demo payments remain local preview only.
- Mark Paid / Undo buttons show a saving state and refresh backend summary after the mutation.
- Saved trips no longer show local fallback payments while backend payments are still loading.

## Protected core

Not changed:

- engine.js
- payments.js
- canTravel.js
- Prisma schema
- backend API contracts
- installments logic
