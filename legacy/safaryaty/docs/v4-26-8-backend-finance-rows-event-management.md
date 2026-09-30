# v4.26.8 — Backend Finance Rows + Event Management

## Goal

Continue the backend migration safely without breaking the demo-first flow or the current UI.

## Added

### 1. Backend finance rows → frontend mapping

When a saved trip loads from the backend, the frontend now calls:

```txt
GET /api/trips/:tripId/finance
```

Then it maps real database rows back into the current frontend arrays:

```txt
Income        → incomeSources
LifeCost      → lifeCosts
Installment   → installments
TripCost      → budget
Expense       → expenses
```

Each mapped item receives:

```txt
backendId
backendModel
```

This makes future edit/delete actions use direct CRUD instead of only snapshot sync.

### 2. Event Management foundation

Backend summary now returns an `events` array.

Events are generated from:

```txt
Income events
Life cost events
Installment events
Trip cost/payment events
```

This creates the first foundation for the Safaryaty financial timeline:

```txt
What money is expected?
What money is leaving?
What is upcoming?
What is paid?
When does each event happen?
```

## Important

The snapshot bridge is still active as fallback. This sprint does not remove `Trip.notes` yet.

## Next

v4.26.9 should start showing the backend event timeline in the UI as a clean Event Management panel:

```txt
Timeline
Upcoming
Paid
Income
Warnings
```
