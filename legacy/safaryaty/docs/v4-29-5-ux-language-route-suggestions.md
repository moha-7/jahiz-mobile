# Safaryaty v4.29.5 — UX Language, Route Country-First & Suggestion CTA

## Scope
UI/UX refinement only. Core engines and backend contracts remain unchanged.

## Changes
- Route picker now collapses when a selected airport is available.
- Route picker is country-first: choose/search a country, then show its airports.
- Direct airport search still works for airport code/city searches.
- Salary payday logic uses the trip start date as its planning anchor when available.
- Suggestion CTA changes color when any suggestion is selected.
- Suggestion CTA now shows selected count and total.
- Removed duplicate wizard footer actions and duplicate Add Custom button.
- Simplified wizard copy for Money and Commitments.

## Source of truth
- Saved trips continue to use backend-first payment and summary logic.
- Demo/draft trips continue to use local preview only.
- `engine.js`, `payments.js`, and `canTravel.js` were not changed.
