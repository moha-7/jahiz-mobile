# v4.29.33 — Critical Calculation Truth Fix

## Scope

Critical calculation truth only. No UI redesign, no external APIs, no Docker, no Prisma schema change.

## Fixed

### Monthly destination costs

Frontend used `ceil(days/30)`. Backend trip-cost totals used calendar month span. Backend payment rows used due-date occurrence stepping. This made frontend, backend totals, and backend rows disagree.

Now monthly destination costs are counted by actual occurrence dates from the due date until trip end.

### Daily destination costs

Backend persistence had no DAILY enum. Daily costs could be saved as one day only. Now daily costs are persisted as `perDay × tripDays` under `TRIP_TOTAL`, without schema change.

## Added tests

- Cross-engine parity tests for:
  - one-time trip cost
  - daily trip cost
  - monthly trip cost across calendar boundaries
  - installment inside trip window
  - installment continuing after trip

## Protected

- Prisma schema unchanged
- FX architecture unchanged
- External API adapters unchanged
- UI flow unchanged
- Score formula unchanged

## Remaining known risks

- Income/life-cost recurrence parity is still out of scope and should be handled in the next truth sprint.
- Installment continuing score signal still needs backend/frontend parity review.
