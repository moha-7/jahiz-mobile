# Safaryaty v4.29.32 — Display Currency Truth + Payments Flow + Action Routing Fix

## Fixes

- Display currency conversion now uses a single conversion helper with direct, inverse, selected-pair, and safe fallback rates.
- AED and USD are no longer allowed to appear as equal values when a valid selected/fallback pair exists.
- Backend summary display conversion was aligned with the same rule for trip/base display.
- Local payment schedule no longer duplicates installments.
- Backend payments now include Monthly Bills / Life Costs, Installments, and Trip Costs.
- Trip Payments filters understand Monthly Bills, Installments, and Trip Costs separately.
- Decision UI now shows the current trip state only instead of the full colored legend in the main card.

## Protected

No Prisma schema changes, no new APIs, no score formula rewrite, no route picker changes, and no suggestion amount logic changes.
