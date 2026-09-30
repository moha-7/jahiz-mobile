# Safaryaty v4.29.4 — Score, Currency & Date Truth Fix

## Purpose

This patch keeps v4.29.3 UI direction and fixes calculation confidence issues without changing the product core.

## Fixes

- Readiness score now reacts better when current savings increase above the trip-cost threshold.
- Safety reserve now affects both available cash and the safety factor in a measurable way.
- `needToSaveLocal` is now part of the frontend engine result instead of being derived inconsistently by UI fallbacks.
- Income or payments dated after the planning window no longer inflate available cash.
- Monthly and daily destination costs still recalculate from the trip date range.
- Current savings are clearly shown as income currency; support money is clearly shown as trip currency, with conversion hints.
- Auto FX rate input is rounded to 4 decimals for cleaner display.
- Backend score logic was aligned with the frontend score sensitivity.

## Protected core

No UI-only patch should change these contracts:

- `engine.js` remains the local/demo calculation engine.
- `payments.js` remains the local/demo payment schedule engine.
- Saved trips must remain backend-first for summary/payments.
- Installments remain core.
- Route picker country/airport data is preserved.

## Added tests

- Score changes when current savings increase.
- Reserve affects available cash and readiness.
- Income after trip end does not inflate available cash.

## Notes

Backend install/build was not completed inside the sandbox due Prisma install timeout, but backend logic was patched in `backend/src/modules/finance/cashflow.engine.ts`.
