# Safaryaty v4.29.43 — Currency Domain Unification

## Why this sprint exists

Currency selection had spread across the Wizard, Trip Costs, Dashboard display controls, frontend fallback tables, backend fallback tables, route changes, and finance synchronization. That made a display preference capable of triggering finance resyncs and made it difficult to prove whether an amount was stored in income currency, trip currency, or display currency.

This release establishes a single currency domain and separates provider/API concerns from deterministic finance calculations.

## Canonical currency model

Safaryaty now has only three currency concepts:

1. **Income currency** — savings, income, life costs, installments and safety reserve.
2. **Trip currency** — support money and destination trip costs; canonical planning/decision currency.
3. **Display currency** — optional Dashboard presentation only; never changes stored economic values.

The central plan currency editor is located only at:

```txt
Improve Plan → Available Money → Currency setup
```

Trip Costs shows the current plan currency but no longer owns another currency editor. Dashboard display is limited to trip currency, income currency, USD or EUR.

## Architecture

### Pure shared currency domain

```txt
shared/currency-domain.js
```

The shared module performs deterministic conversion only. It does not call providers, read environment variables, use static emergency tables or mutate persistence.

It receives a resolved rate and returns converted values. Missing cross-rates return `null`; raw numbers are never silently relabelled as another currency.

### Provider/API layer

```txt
src/currency-service.js
backend/src/modules/fx/fx.service.ts
```

Provider resolution, TTL, cached snapshots, last-known-good values and source metadata remain outside the finance engine.

### Atomic saved-trip currency update

```http
PATCH /api/trips/:tripId/currency-context
```

The endpoint converts income-side and trip-side records in one transaction while preserving row IDs and PaymentMark records. It is also used for route changes that imply a new destination currency.

## Source-of-truth rules

- Calculations consume the selected `incomeCurrency → tripCurrency` planning rate only.
- Display conversion consumes a separate pair from `rateBook`.
- Display changes use metadata-only updates and never rebuild finance rows.
- Automatic rate refresh uses metadata-only updates and never rebuilds finance rows.
- Actual income/trip currency changes use the atomic currency-context endpoint.
- Manual rate and provider metadata are stored separately from financial values.
- Backend display cards read the persisted `rateBook`; backend and frontend no longer own separate static fallback tables.

## Data converted on actual plan-currency changes

### Income-side

- current savings
- safety reserve
- income sources
- life costs
- installments

### Trip-side

- support money
- trip costs
- preset suggestion values

Historical expenses keep their recorded natural currency and are converted by the finance engine when read.

## Payment safety

Currency-context updates do not delete or recreate finance rows. Existing IDs stay stable and `PaymentMark` rows are not modified. A display-currency change cannot reset Paid Already or return paid occurrences to zero.

## Compatibility

The release keeps the current trip payload and API structure compatible. `src/fx.js` remains as a thin compatibility facade over the shared domain.

## Verification completed

- currency-domain unit tests
- frontend/backend currency-flow contract tests
- draft/saved finance parity tests
- recurring-payment tests
- FX snapshot/provider tests
- stability smoke
- production frontend build
- backend external-data tests
- TypeScript syntax transform for modified backend files

A full Prisma-generated backend typecheck must still be run on a machine that can download or already has the Prisma engines.
