# v4.29.34 — Income/Life Occurrence + Category/Verdict Reconciliation

## Scope
This sprint continues the Critical Truth work from v4.29.33. It does not add APIs, Docker, ML, Prisma schema changes, or UI redesign.

## Fixes

### 1. Backend income/life totals now use occurrence counting
Previously backend totals for monthly income and monthly life costs used calendar-month inflation while backend rows used actual due-date stepping. This meant backend `available` could disagree with its own payment/events rows.

New rule:

```txt
Monthly income/life total = amount × actual occurrences from start/due date until end date
One-time income/life total = counted only if its expected/due date is inside the planning window
```

This mirrors the frontend cashflow engine.

### 2. Backend income events now expand per occurrence
Monthly income events now generate one row per expected occurrence. Life cost events are not duplicated separately because payment rows already include life cost rows.

### 3. Trip category canonicalization foundation
Added backend category taxonomy:

```txt
backend/src/modules/finance/categories.ts
```

The backend now canonicalizes trip cost categories to ids such as:

```txt
cat-flight
cat-accommodation
cat-food
cat-transport
cat-activities
cat-shopping
cat-emergency
```

Labels stay user-friendly, but matching is done using canonical ids.

### 4. Suggestions use canonical category ids
Backend suggestion templates now emit canonical category ids instead of mixed labels like `Food`, `Transportation`, or `Flights`. Suggestion apply also finds existing costs by canonical category or legacy label to avoid duplicates.

### 5. Backend status/verdict softened to score-aware logic
Backend `status/headline/message` now uses both remaining money and readiness score. This reduces contradictions where backend says READY only because remaining is positive while the score still warns that timing/safety is weak.

## Tests
Added parity checks to `src/crossEngineParity.test.js`:

- monthly income/life costs use occurrences, not calendar inflation
- one-time income after trip is ignored in both engines

## Acceptance Criteria

- Monthly income and life cost totals match frontend occurrence logic.
- One-time income after the trip does not inflate saved/backend available cash.
- Backend suggestions do not duplicate selected trip costs because of label/id mismatch.
- No Prisma schema change.
- No external API/frontend API call added.
