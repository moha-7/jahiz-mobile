# Safaryaty v4.29.21 — MVP Logic QA & Source-of-Truth Audit

## Scope

Stability and audit sprint. No new product features.

## Added

- Fixed frontend local engine currency bug found by the new QA test: `availableLocal` now uses `baseToTrip(availableBase, trip)` instead of always multiplying by `exchangeRate`. This protects same-currency trips from fake inflation.
- `qa/mvp-logic-qa-matrix.md` with detailed manual QA scenarios.
- Extra unit tests for:
  - currency conversion direction
  - support money not double-converted
  - same-currency behavior
  - high-cash coverage not faking 100
  - emergency improving safety
- Visible toast feedback if direct backend finance sync fails.

## Confirmed Principles

- Salary, savings, support, and ready cash are money sources.
- Suggestions are trip-cost estimates.
- Selected trip costs are the only suggestion outputs that should enter the plan.
- Backend summary remains source of truth for saved trips.
- Local engine remains preview for demo/draft.

## Known Audit Items For Later

- Review backend expense currency naming around `amountBase`.
- Add backend integration tests for suggestion apply with no duplicate TripCost.
- Move category mapping fully to backend response to reduce frontend mapping risks.
- Add visible retry action for failed sync, not just toast.
