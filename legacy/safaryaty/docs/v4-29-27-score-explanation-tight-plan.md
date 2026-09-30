# Safaryaty v4.29.27 — Score Explanation + Tight Plan Logic + Delete Sync Reconciliation

## Changes
- Added colored trip states: Blocked / Risky / Tight / Almost / Ready.
- Added score factor breakdown in the decision card.
- Added tight-plan logic when the plan is covered but leftover buffer is below 8%.
- KPI notes now show left after trip and warn when there is no saving gap but the buffer is low.
- Delete 404 / Item not found is treated as already removed and refreshes the plan instead of showing a scary backend error.

## Not changed
- Currency API
- FX conversion logic
- Prisma schema
- Backend API contracts
- Payment source of truth
- Suggestion generation
