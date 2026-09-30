# Safaryaty v4.29.13 — UI/UX Alignment + Currency Guard

## Scope
Frontend UI/UX only on top of v4.29.12. Backend, API contracts, Prisma schema, engine contracts, and payment source-of-truth were not changed.

## Changes
- Navigation labels aligned with the product IA:
  - Home → Dashboard
  - Payments → Trip Payments
  - Monthly Payments → Commitments
  - Advice → Recommendations
  - Travel Profile → Profile
- Wizard steps aligned with user intent:
  - Trip Details
  - Available Money
  - Commitments
  - Trip Costs
  - Decision
- Added Simple / Advanced microcopy:
  - Simple = quick decision view
  - Advanced = full financial planning view
- Added currency guard UI to the currency/rate block:
  - Auto API rate
  - Manual rate
  - Needs review
  - Same currency
- Added a visible note that all pages use one selected exchange rate.

## Currency API note
No currency API or backend behavior was changed. The UI only makes the existing auto/manual rate state clearer.

## Protected
- No backend change
- No calculation change
- No duplicate source of truth
- No score change
- No payment logic change
- No suggestion engine change
