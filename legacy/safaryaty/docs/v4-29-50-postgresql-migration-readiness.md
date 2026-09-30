# Safaryaty v4.29.50 — PostgreSQL Migration Readiness

## Scope

This release prepares a safe PostgreSQL target without switching the running application away from SQLite.

The active local schema remains:

```txt
backend/prisma/schema.prisma → SQLite
```

The proposed target is isolated at:

```txt
backend/prisma/postgresql/schema.prisma → PostgreSQL
```

No production cutover or data import occurs in this sprint.

## Money precision

PostgreSQL target fields use:

```txt
Money values: Decimal(19,4)
Planning FX rate: Decimal(20,10)
```

This removes binary floating-point storage from the PostgreSQL target while preserving compatibility with the current JavaScript calculation layer, which already normalizes values with `Number(...)` at engine boundaries.

The following fields are covered:

- Trip.exchangeRate
- TripFinanceProfile starting savings, support and reserve
- Income.amount
- LifeCost.amount
- Installment.amount
- TripCost.amount
- Expense.amount and amountBase
- PresetSuggestion current, suggested and difference values

## Date and timezone strategy

Planning dates are date-only values:

```txt
departureDate
returnDate
startDate
endDate
expectedDate
dueDate
Expense.date
```

They use PostgreSQL `DATE`.

Audit/event timestamps use:

```txt
TIMESTAMPTZ(3)
```

This prevents timezone conversion from moving a trip or payment to the previous/next calendar day while keeping actual events unambiguous.

## Constraints and indexes

The PostgreSQL baseline adds database-level protection for:

- positive exchange rates;
- positive traveler counts;
- non-negative financial values;
- valid currency-code format;
- valid start/end date ordering;
- non-empty PaymentMark occurrence keys;
- unique `(tripId, paymentKey)` occurrence state;
- unique external snapshot resources.

Additional indexes cover common access paths:

- user/status/updated trip lookup;
- due-date and expected-date queries;
- trip-cost status/date and category queries;
- payment status and update lookup;
- external provider freshness lookup.

## Migration bundle

The source export produces one JSON file per table plus a manifest.

```bash
cd backend
npm run db:migration:bundle:export
```

Sessions are excluded by default so users authenticate again after cutover. To include sessions deliberately:

```bash
npm run db:migration:bundle:export:sessions
```

Every bundle contains:

- row counts;
- SHA-256 table checksums;
- global checksum;
- exact decimal-string financial totals;
- relation validation;
- duplicate PaymentMark detection;
- date and exchange-rate validation.

Verify the bundle before any target import:

```bash
npm run db:migration:bundle:verify -- --bundle=PATH_TO_BUNDLE
```

## PostgreSQL target verification

After a future import, generate the isolated PostgreSQL client and verify the target against the source manifest:

```bash
npm run prisma:postgres:generate
npm run db:postgres:target:verify -- --bundle=PATH_TO_BUNDLE
```

The verifier compares:

- every table row count;
- table checksums;
- financial totals per field;
- relation integrity;
- global checksum.

## Readiness commands

```bash
cd backend
npm run db:postgres:audit
npm run prisma:postgres:validate
npm run prisma:postgres:generate
npm run prisma:postgres:baseline:sql
```

The audit is local and does not require a database. Prisma validation/generation still needs the Prisma engine to be available.

## Deliberately deferred

The following are not performed in v4.29.50:

- creating a hosted PostgreSQL database;
- importing production records;
- switching the backend datasource;
- deleting the SQLite database;
- deleting `Trip.notes` compatibility data;
- changing the application runtime client;
- enabling dual-write between two databases.

Those belong to the controlled cutover sprint after the source bundle and target environment both pass validation.
