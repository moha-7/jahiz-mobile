# v4.29.35 — FX Single Source + PaymentMark Unification

## Goal
Keep the MVP stable while removing two hidden truth risks:

1. Display FX conversion had duplicate helper implementations in the UI and backend summary.
2. Recurring payment rows could still inherit item-level `PAID` and mark every occurrence as paid.

## Decisions

### FX
- Frontend display conversion now goes through `src/fx.js`.
- Backend display conversion now goes through `backend/src/modules/finance/currency.ts`.
- Stored planning amounts are not mutated when the display currency changes.
- Base/income → trip still uses the selected `exchangeRate`.
- Trip → display uses direct, inverse, selected-pair, or safe fallback logic.

### Payment marks
- Saved-trip payment events remain canonical through `PaymentMark` keyed by payment occurrence id.
- Recurring installments and monthly trip costs must not inherit item-level `PAID` for all rows.
- Item-level `PAID` remains only as a legacy fallback for one-time items.

## Not changed
- No Prisma schema change.
- No API contract change.
- No external APIs.
- No Docker.
- No ML.
- No UI redesign.

## Manual QA
1. Show results in AED while trip currency is USD. Numbers must convert, not stay equal.
2. Mark only one monthly rent/trip-cost occurrence as paid. Only that row should move to Paid.
3. Mark only one installment occurrence as paid. Other installment rows stay upcoming.
4. Refresh saved trip and verify the paid state persists through backend summary.
