# Safaryaty v4.29.49 — Database Normalization Foundation

## Goal

Move the core trip-level finance settings out of the large `Trip.notes` snapshot without breaking existing trips, SQLite, or the current frontend contract.

This release is a transition foundation, not the PostgreSQL cutover.

## New normalized model

```prisma
model TripFinanceProfile {
  tripId           String   @id
  startingSavings  Float
  supportMoney     Float
  safetyReserve    Float
  reserveEnabled   Boolean
  returnWithZero   Boolean
  rateBookJson     String?
  schemaVersion    Int
  normalizedAt     DateTime?
}
```

The profile is one-to-one with `Trip` and is deleted automatically with the trip.

## Data ownership

The normalized profile now owns:

- current/starting savings;
- support money;
- safety reserve amount;
- whether the reserve is enabled;
- return-with-zero preference;
- persisted rate-book snapshot;
- profile schema version.

Line items remain in their existing normalized tables:

- Income;
- LifeCost;
- Installment;
- TripCost;
- Expense;
- PaymentMark;
- PresetSuggestion.

## Dual-read strategy

Backend calculations use:

```txt
TripFinanceProfile when present
→ otherwise legacy Trip.notes
```

This keeps old trips readable before the backfill is run.

The backend summary exposes `details.financeProfileSource` internally as:

```txt
normalized-profile
legacy-notes
```

## Dual-write strategy

The frontend trip payload now sends both:

```txt
financeProfile
legacy notes snapshot
```

The following flows keep both representations synchronized:

- create trip;
- patch trip metadata;
- full finance snapshot sync;
- income/trip currency conversion.

A normalized profile always overrides stale values inside notes when the trip is loaded.

## Migration

Migration added:

```txt
backend/prisma/migrations/202606220003_trip_finance_profile_foundation
```

Apply with:

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate:deploy
```

## Backfill

Dry run:

```bash
npm run db:backfill:finance-profile:dry
```

Apply missing profiles:

```bash
npm run db:backfill:finance-profile
```

Overwrite existing profiles from legacy snapshots only when deliberately required:

```bash
npm run db:backfill:finance-profile -- --force
```

The script reports:

- scanned rows;
- created/updated/skipped rows;
- legacy drift;
- missing profiles;
- source and target financial checksums.

## Compatibility

- `Trip.notes` is not removed.
- Existing API clients continue to work.
- Trips without a profile continue reading from notes.
- No line-item tables or PaymentMark records are recreated by this migration.
- No money type is changed to Decimal yet; that belongs to the PostgreSQL migration phase.
