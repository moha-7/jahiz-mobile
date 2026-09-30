# Safaryaty v4.28.1 — Simple Mode UI Foundation

## Scope

UI/UX refactor only. No core calculation, payment, can-travel, backend, Prisma, or API contract changes.

## What changed

- Navigation now uses human labels:
  - Overview → Home
  - To Pay → Payments
  - Budget → Trip Costs
  - Installments → Monthly Payments
  - Suggestions → Advice
  - Trips → My Trips
  - Profile → Travel Profile
- Home is decision-first: Can I travel, next action, and four cards max.
- KPI cards were simplified:
  - Safe Money
  - Need to Save
  - Payments Left
  - Paid
- Technical source labels are hidden from Simple Mode and only appear in Advanced Mode.
- Payments page copy is now human and no longer exposes backend/event wording.
- Advanced details use “Show full analysis”.
- Cashflow is renamed to Cashflow Summary.
- Mobile navigation keeps only core tabs visible.

## Protected core

Untouched:

- `engine.js`
- `payments.js`
- `canTravel.js`
- backend summary logic
- installments logic
- mark paid / undo behavior
- currency calculations
- tests

## Acceptance checklist

- Home answers “Can I take this trip?” first.
- Simple Mode hides technical/debug wording.
- Advanced Mode still exposes cashflow/categories.
- Payments remain functional.
- Installments remain core.
- Mobile navigation is lighter.
- `npm run test:all` passes.
- `npm run build` passes.
