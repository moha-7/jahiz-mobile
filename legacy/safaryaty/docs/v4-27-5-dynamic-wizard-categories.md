# Safaryaty v4.27.5 — Dynamic Wizard Categories

## Goal

Make the wizard content fit the selected trip purpose without changing the core calculation engine yet.

## What changed

- Trip Purpose remains outside the wizard in the New Trip intent selector.
- Wizard Step 1 remains `Route & Dates`.
- Step 3 is now clearer as `Existing Commitments`.
- Step 5 is now `Destination Costs`.
- Destination quick-add cards now change by trip purpose:
  - Short Trip
  - Long Stay
  - Study Trip
  - Family Visit
  - Business Trip
  - Event Trip
  - Medical Trip
  - Relocation Trip
  - Adventure Trip
  - Couple / Honeymoon
- Added category metadata foundations:
  - `costType`: ONE_TIME / DAILY / MONTHLY / TRIP_TOTAL / SETUP
  - `currencyScope`: DESTINATION / ORIGIN / INCOME

## Product rule

Existing Commitments are home/origin obligations that continue while traveling.
Destination Costs are spending in the country the user is going to.

## Not changed yet

- Monthly destination calculations are not fully separated yet.
- Suggestions are not fully backend-generated yet.
- APIs like Booking/Google are not connected yet.

## Next sprint

v4.27.6 — Monthly Destination Cost Logic

- SHORT_TOTAL: daily/total costs.
- LONG_MONTHLY: monthly destination costs × months.
- HYBRID: setup costs + monthly destination costs.
