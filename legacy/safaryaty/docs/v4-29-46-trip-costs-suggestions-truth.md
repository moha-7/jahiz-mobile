# v4.29.46 — Trip Costs & Suggestions Truth

## Goal

Stabilize the complete Trip Costs and Suggestions domain without changing the canonical affordability, currency, decision, or payment-progress rules completed in earlier sprints.

## Source-of-truth decisions

### Trip-cost identity

- Every selected trip cost remains an independent `TripCost` row.
- Multiple custom costs may share the same category.
- A provider/generated suggestion is idempotent by its suggestion identity and canonical category.
- Applying a suggestion never overwrites a manually entered cost.

### Categories

Frontend and backend use canonical IDs from:

```txt
shared/trip-cost-domain.js
```

Core IDs:

```txt
cat-flight
cat-accommodation
cat-food
cat-transport
cat-activities
cat-shopping
cat-gifts
cat-emergency
cat-other-trip
```

Legacy labels such as `Food`, `Food & Cafes`, `Transportation`, and `Local Transport` are normalized before matching.

### Frequency and amount meaning

The stored amount is the entered unit amount. The effective trip total is calculated from frequency and the trip dates:

```txt
TRIP_TOTAL / ONE_TIME = amount
DAILY = amount × trip days
WEEKLY = amount × due-date weekly occurrences
MONTHLY = amount × due-date monthly occurrences
YEARLY = amount × due-date yearly occurrences
```

Daily costs remain daily in persistence. They are shown as one aggregated payment row, for example `Food · 10 days`, rather than creating ten noisy rows.

### Suggestion lifecycle

```txt
PENDING → ACCEPTED → PENDING
            apply      remove/restore
```

- Generation reconciles existing suggestions instead of deleting and recreating all rows.
- Apply runs in one transaction.
- Double clicks are blocked in the UI.
- Remove restores the original suggestion to PENDING.
- Regeneration does not duplicate an accepted suggestion.

### Currency

- Suggestions and selected trip costs use the canonical Trip Currency.
- Range/profile adapters return an explicit currency.
- No trip-cost code performs an independent hidden FX conversion.
- Changing Display Currency remains presentation-only.

## Main implementation

```txt
shared/trip-cost-domain.js
src/engine.js
src/payments.js
src/api.js
src/main.jsx
backend/src/modules/finance/cashflow.engine.ts
backend/src/modules/trips/finance.mapper.ts
backend/src/modules/suggestions/suggestions.engine.ts
backend/src/modules/suggestions/suggestions.routes.ts
backend/prisma/schema.prisma
```

## Schema impact

The Prisma `Frequency` enum now includes:

```txt
DAILY
WEEKLY
MONTHLY
YEARLY
ONE_TIME
TRIP_TOTAL
```

SQLite stores enum values as text, so the included SQLite migration is intentionally a no-op. PostgreSQL must create/use the corresponding enum values during the future database migration.

## Legacy saved-trip note

Older releases may have flattened DAILY costs into `TRIP_TOTAL`. Opening and saving those trips through the current finance sync will preserve the stored total but cannot reconstruct a lost original per-day amount automatically. Review old DAILY entries manually before PostgreSQL migration or create a one-time data backfill from retained client snapshots where available.

## Acceptance criteria

- A suggestion cannot be applied twice by rapid clicking.
- “Add essentials” remains idempotent.
- Manual costs are never overwritten by suggestion application.
- Removing an accepted suggestion removes only its suggestion-owned cost and restores the suggestion.
- Emergency exists once unless the user deliberately creates additional custom entries.
- Daily, weekly, monthly, yearly, one-time, and trip-total costs calculate consistently in frontend/backend logic.
- Daily costs create one aggregated payment row.
- Reload does not duplicate suggestions or selected costs.
- No hard-coded AED/EGP minimum leaks into BHD or other trip currencies.

## Automated verification

```txt
122/122 frontend/core tests passed
6/6 backend external/provider tests passed
Stability smoke passed
Frontend production build passed
QA release gate passed
Changed backend TypeScript files passed syntax transforms
```

A full backend TypeScript build could not be completed in the current environment because `prisma generate` could not download the Prisma engine from `binaries.prisma.sh` (`EAI_AGAIN`).
