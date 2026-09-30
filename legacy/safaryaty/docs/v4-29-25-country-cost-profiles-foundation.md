# Safaryaty v4.29.25 — Country Cost Profiles Foundation

## Purpose

Move suggestions one step closer to real travel estimates without using salary, savings, support money, or available cash.

## Added

### Frontend
- `src/data/costProfiles.js`
- Country/tier cost profile estimates for:
  - flights
  - accommodation
  - food
  - transport
  - activities
  - shopping
  - emergency
- Suggestions now use destination country, duration, travelers, and comfort level.
- If the selected trip currency differs from the destination profile currency, the engine uses a safe tier fallback in the selected trip currency and exposes this in the suggestion explanation.

### Backend
- `backend/src/modules/suggestions/cost-profiles.ts`
- Backend suggestion engine now uses category estimates instead of baseline split weights.
- The suggestion engine still avoids salary, savings, support money, ready money, and available cash.

## Protected

Not changed:
- FX API behavior
- currency conversion logic
- score formula
- Prisma schema
- API contracts
- payment source of truth
- route picker
- date logic

## Tests

Added `src/costProfiles.test.js`.

Covered:
- profile estimates include all core categories
- premium comfort increases estimated trip costs
- unknown countries fall back safely to tier profiles
