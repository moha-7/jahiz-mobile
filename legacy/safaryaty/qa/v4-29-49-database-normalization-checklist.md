# v4.29.49 — Database Normalization QA

## Before migration

- Back up the SQLite database.
- Record trip count and finance-row counts.
- Record Dashboard values for at least one complex trip.

## Migration

Run:

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate:deploy
npm run prisma:validate
npm run db:backfill:finance-profile:dry
npm run db:backfill:finance-profile
```

Expected:

- `failed = 0`;
- `missingAfter = 0`;
- `checksumMatch = true`.

## Legacy trip fallback

Open an old trip before backfill.

Expected:

- savings, support and reserve still load from notes;
- Dashboard and score remain unchanged;
- backend summary reports `legacy-notes`.

## Normalized trip precedence

After backfill, intentionally make the legacy notes values stale in a test database.

Expected:

- normalized profile values win;
- backend summary reports `normalized-profile`;
- frontend displays normalized values.

## Dual write

Change each value through the UI:

- Current Savings;
- Support Money;
- Safety Reserve;
- Return With Zero;
- Display/FX rate snapshot.

Reload and verify:

- `TripFinanceProfile` changed;
- notes snapshot remains compatible;
- no Income/LifeCost/Installment/TripCost rows were duplicated.

## Currency conversion

Change Income Currency and Trip Currency.

Expected:

- starting savings and reserve convert with income currency;
- support converts with trip currency;
- rateBook persists in the normalized profile;
- PaymentMark rows remain unchanged.

## Finance invariants

Compare before and after migration:

```txt
Ready Money
Trip Plan Cost
Paid So Far
Still To Pay
Need To Save
After-Trip Position
Readiness
Verdict
```

All values must remain economically identical.
