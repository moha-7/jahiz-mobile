# v4.29.19 — Force Emergency Suggestion Visibility

## Fixed

- Emergency now always appears inside Suggested costs when it is not already selected.
- Premium local split no longer gives Emergency a zero weight.
- If backend templates or fallback suggestions miss Emergency, the UI injects a safety fallback suggestion.
- Emergency remains an inline quick card, not a separate section.

## Not changed

- Currency API
- Score logic
- Backend contracts
- Prisma schema
- Payment logic
- Date logic
