# Safaryaty v4.29.2 — Wizard UX Recovery + Finance Truth Fix

## Purpose
Focused recovery patch on top of v4.29.1.

## What changed
- Route search remains, but results are compact list rows instead of heavy grid cards.
- Existing Commitments are clarified into Home bills + Installments.
- Destination wording is shorter and Apply Selected is clearer.
- Safety reserve controls are visible again in Money step.
- Numeric inputs normalize leading zeros: `01` → `1`, `0500` → `500`.
- Saved trip Payments are backend-first. Local paid state is only for draft/demo preview.
- Backend trip-cost payments now expand MONTHLY destination costs into monthly payment occurrences.

## Not changed
- engine.js
- payments.js
- canTravel.js
- installments core logic
- currency engine
- Prisma schema

## Tests
- Frontend `npm run test:all` passing.
- Frontend `npm run build` passing.
