# Safaryaty v4.29.44 — Finance Truth Stabilization + Modern UI

## Product decision

Safaryaty currently behaves as a **financial planner with payment-progress tracking**, not as a live bank wallet.

Therefore marking a payment paid changes progress only. It does not create extra Ready Money or remove the original cost from affordability.

## Canonical finance rules

```txt
Funding Pool = Current Savings + Expected Income + Support Money
Ready Money = Funding Pool - Safety Reserve - Origin Commitments
Trip Plan Cost = all destination-cost occurrences
Need To Save = max(0, Trip Plan Cost - Ready Money)
After-Trip Position = Ready Money - Trip Plan Cost
Total Tracked Outgoings = Origin Commitments + Trip Plan Cost
Paid So Far + Still To Pay = Total Tracked Outgoings
```

### Payment progress invariant

`Mark Paid` and `Undo` may change only:

- Paid So Far
- Still To Pay
- paid/upcoming occurrence counts

They must not change:

- Ready Money
- Trip Plan Cost
- Need To Save
- After-Trip Position
- canonical verdict merely because the progress state changed

## Implementation

### Shared finance domain

Added:

- `shared/finance-ledger.js`
- `shared/finance-ledger.d.ts`

The shared module owns:

- payment-ledger partitioning;
- planner affordability formulas;
- invariant metadata.

### Frontend engine

`src/engine.js` now:

- subtracts all scheduled origin commitments from affordability, regardless of paid state;
- derives Paid So Far and Still To Pay from one normalized payment ledger;
- keeps payment progress separate from affordability;
- returns `totalTrackedOutgoingsLocal`, `ledger`, and `affordability`.

### Backend summary

`backend/src/modules/finance/cashflow.engine.ts` now:

- uses the same shared planner-affordability rules;
- returns `stillToPay` and `totalTrackedOutgoings` beside `paid`;
- returns a ledger block with invariant data;
- uses indexed occurrence keys for one-time and recurring life/trip-cost rows;
- still reads legacy non-indexed PaymentMark keys for backward compatibility.

### Saved-trip hydration

`mergeBackendSummary()` now hydrates:

- Paid So Far
- Still To Pay
- Total Tracked Outgoings
- Need To Save
- Ready Money
- After-Trip Position

from the same backend summary instead of mixing backend Paid with local Still To Pay.

## UI modernization

- clearer primary deep-action button versus full Improve Plan editor;
- modern button hierarchy, hover, active, and keyboard-focus states;
- improved cards, KPI surfaces, tabs, fields, modal and Wizard sidebar;
- compact user-facing toasts;
- technical sync/provider language removed from normal toast messages;
- payment and finance logic remain independent from visual changes.

## Compatibility

No Prisma schema change was made.

Legacy one-time PaymentMark keys remain readable while new canonical output uses indexed occurrence keys.
