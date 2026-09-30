# Safaryaty v4.29.3 — Wizard Flow Refinement

This patch refines the wizard without changing the core engines.

## Included

- Route picker now collapses after choosing an airport.
- Route selection now works as: search/region/country → airports for that country/region.
- Income cards stay left aligned.
- Monthly salary uses a simple Salary Day and keeps an advanced first salary date.
- Commitments step is now split inside the same step:
  - A. Monthly bills
  - B. Installments
- Destination suggestions are preselected by default.
- Suggestion total updates dynamically when the user edits amounts or unchecks items.
- `Apply selected` wording changed to `Add selected to plan`.
- Numeric inputs continue normalizing leading zero values such as `01` → `1` and `0500` → `500`.

## Preserved

- `engine.js`
- `payments.js`
- `canTravel.js`
- backend summary contracts
- installments core logic
- backend-first saved payment plan behavior

## Product rule

Frontend is still only the interface. For saved trips, payments and summaries remain backend-first. Draft/demo can still use local preview until saved.
