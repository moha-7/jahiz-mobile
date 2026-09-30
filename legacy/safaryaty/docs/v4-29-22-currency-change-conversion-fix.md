# Safaryaty v4.29.22 — Currency Change Conversion Fix

## Scope

Fixes the critical bug where changing Trip Currency kept existing trip-cost numbers unchanged and reinterpreted them as the new currency.

## Implemented

- Added `convertTripCurrencyAmounts()` helper in frontend state flow.
- Trip-local amounts are converted using old rate and new confirmed/manual rate.
- Conversion runs after auto-rate confirmation when the new rate was not already known.
- Conversion runs immediately if a remembered rate exists.
- Conversion also runs when user enters a manual rate after changing currency.
- Added QA documentation for manual verification.

## Preserved

- Currency API contract.
- Backend contracts.
- Prisma schema.
- Payment source of truth.
- Suggestion engine/source rules.
- Score formula.

## Important

This patch focuses only on frontend trip state conversion for trip-local amounts. Backend persisted saved trips should be validated in QA after changing currency and saving/reloading.
