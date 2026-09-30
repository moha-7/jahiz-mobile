# Safaryaty v4.26.6 — Finance CRUD API Layer

This sprint keeps the Demo-first flow and backend summary UI intact, and adds an explicit frontend API layer for finance CRUD operations.

## Added to `src/api.js`

- `api.createFinanceItem(tripId, type, item, trip)`
- `api.updateFinanceItem(type, itemId, payload)`
- `api.deleteFinanceItem(type, itemId)`
- `api.markTripCostPaid(itemId)`
- `api.undoTripCostPaid(itemId)`
- `api.markInstallmentPaid(itemId)`
- `api.undoInstallmentPaid(itemId)`
- `clientFinanceItemToApiPayload(type, item, trip)`

## Backend endpoints already available

- `POST /api/trips/:tripId/incomes`
- `POST /api/trips/:tripId/life-costs`
- `POST /api/trips/:tripId/installments`
- `POST /api/trips/:tripId/costs`
- `POST /api/trips/:tripId/expenses`
- `PATCH /api/incomes/:id`
- `PATCH /api/life-costs/:id`
- `PATCH /api/installments/:id`
- `PATCH /api/costs/:id`
- `PATCH /api/expenses/:id`
- `DELETE /api/:model/:id`

## Why this matters

The previous transition layer still syncs the full trip snapshot into finance tables. This version prepares the UI to move item-by-item into backend CRUD without breaking the current stable flow.

## Next sprint

`v4.26.7 — Finance UI Direct CRUD Sync`

- Assign backend IDs to client items.
- Create items in DB only after they become valid.
- Update specific item rows after edits.
- Delete specific rows instead of full snapshot sync.
- Keep snapshot bridge as fallback only.
