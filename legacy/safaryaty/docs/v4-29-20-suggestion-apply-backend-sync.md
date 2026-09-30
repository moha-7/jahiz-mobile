# v4.29.20 — Suggestion Apply Backend Sync

## Scope

Make suggestion add/remove safer for saved trips without changing the UI flow.

## Changes

- Backend suggestion apply now accepts an optional amount override.
- Adding a backend suggestion from the basket calls the suggestion apply endpoint instead of creating a duplicate trip cost.
- The returned backend TripCost id is attached back to the local selected cost card.
- Removing a selected cost still deletes the TripCost and also marks the original suggestion ignored when the local suggestion id is available.
- Demo/draft/local fallback behavior remains local.

## Protected

- No Prisma schema changes.
- No API endpoint path changes.
- No currency API changes.
- No score formula changes.
- No payment source-of-truth changes.

## Rule preserved

Suggestions are trip-cost estimates. They never allocate salary, savings, support money, or ready cash.
