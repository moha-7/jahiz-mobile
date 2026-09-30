# Safaryaty v4.29.12 — Suggestions Basket UX

## Scope

Destination suggestions UX + safety review for suggestion amount source.

## Changes

- Suggestions no longer appear as auto-selected bulk grid.
- Suggested costs and selected costs are split into two basket sections.
- Add recommended / Add custom moves the item into Your selected trip costs.
- Selected items disappear from the suggestions list.
- Remove sends the item back to suggestions.
- Selected item cards can be edited directly in the basket.
- Suggestion estimates no longer use salary, savings, support money, or available cash as the base.
- Backend suggestion generation was patched to avoid using `summary.cards.available` as budget base.

## Protected

- No API contract changes.
- No Prisma schema changes.
- No payment source-of-truth changes.
- No score formula changes in this patch.

## Important

Suggestions are trip-cost estimates only. Money-in values should affect readiness/affordability, not create cost allocations.
