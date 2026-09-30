# Safaryaty v4.25 — Finance DB Foundation

This sprint keeps the current UI/UX and calculation experience, but starts moving the real financial data into normalized backend tables.

## What changed

- Added backend mapper: `backend/src/modules/trips/finance.mapper.ts`.
- Added endpoint:
  - `POST /api/trips/:tripId/finance/sync-client-snapshot`
- Added endpoint:
  - `GET /api/trips/:tripId/finance`
- Existing endpoint remains:
  - `GET /api/trips/:tripId/summary`
- Added generic item update foundation:
  - `PATCH /api/:model/:id`
- Frontend `api.saveClientTrip()` now syncs financial arrays into DB tables after creating/updating trip snapshot.

## Why this step matters

Before this sprint, trips were owned by users in the database, but the financial structure was still mostly stored as a client snapshot inside `Trip.notes`.

Now the backend also mirrors:

- Income sources → `Income`
- Life costs → `LifeCost`
- Installments → `Installment`
- Trip costs → `TripCost`
- Expenses → `Expense`

This lets the backend summary engine calculate from real database rows.

## Important Product Rule

The frontend remains smooth and fast. The backend becomes the source of truth gradually.

This sprint does not remove the snapshot bridge yet. It adds normalized finance sync alongside it.

## Testing

1. Login/register.
2. Create a draft trip.
3. Add income, life costs, installments, trip costs.
4. Finish the wizard.
5. Open Prisma Studio and confirm rows were created in:
   - Income
   - LifeCost
   - Installment
   - TripCost
6. Open:
   - `GET /api/trips/:tripId/summary`
   - `GET /api/trips/:tripId/finance`
