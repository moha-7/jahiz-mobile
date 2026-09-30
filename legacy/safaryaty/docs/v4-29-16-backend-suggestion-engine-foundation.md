# Safaryaty v4.29.16 — Backend Suggestion Engine Foundation

## Scope

Move trip cost suggestions toward a backend/template source while preserving the existing basket UX and safe local fallback.

## Included

- Added `backend/src/modules/suggestions/suggestions.engine.ts`.
- Backend suggestion generation now uses templates + trip context + existing trip costs.
- Backend suggestions explicitly do not use salary, savings, support money, ready cash, or available money as a source.
- Existing API routes are preserved:
  - `POST /api/trips/:tripId/suggestions/generate`
  - `GET /api/trips/:tripId/suggestions`
  - `POST /api/suggestions/:id/apply`
  - `POST /api/suggestions/:id/ignore`
- Frontend API now maps backend suggestions to the current basket UI shape.
- Saved trips use backend suggestions when available.
- Draft/demo trips keep the local safe fallback.
- Basket UI displays the suggestion source: backend templates / syncing backend templates / local safe fallback.

## Protected

Not changed:
- Currency API behavior
- FX refresh logic
- Score formula
- Payment logic
- Prisma schema
- API route contracts
- Suggestion basket interaction model

## Product rule

Money sources affect readiness and affordability.
Trip cost suggestions estimate expected costs.
Selected trip costs are what enter the actual plan.

These three concepts must remain separate.
