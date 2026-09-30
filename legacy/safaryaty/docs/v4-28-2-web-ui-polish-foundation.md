# v4.28.2 — Web UI Polish Foundation

## Scope

UI/UX polish only. No core logic changes.

## What changed

- Home is now more decision-first:
  - Can you take this trip?
  - Score
  - Next action
  - 4 summary cards
  - 2 top advice items
- Technical and detailed analysis is moved behind `Show full analysis`.
- Removed global KPI strip from every tab; KPIs now belong to Home.
- Added a right-side Travel Coach panel on desktop web.
- Payments cards and page spacing are cleaner.
- Web layout gets better spacing, cards, shadows, and hierarchy.
- Mobile app logic is not part of this sprint.

## Not touched

- `engine.js`
- `payments.js`
- `canTravel.js`
- tests
- backend schema
- payment logic
- installments logic
- currency engine

## Product rule

Simple outside. Smart inside.

Home should answer the decision first. Advanced analysis should stay available, but not be the default view.
