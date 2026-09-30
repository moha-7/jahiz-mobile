# Safaryaty v4.26.1 — Backend Safety Patch

Built on the original v4.26 backend summary / mark-paid branch. This patch does not redesign the product and does not remove existing features.

## Fixed now

- Closed mass-assignment risk in generic finance item updates.
  - Removed `z.object({}).passthrough()`.
  - Added strict PATCH schemas per finance model.
  - `tripId`, `createdAt`, `updatedAt`, and unknown fields are no longer accepted.
- Added in-memory auth rate limiting for `/api/auth/register` and `/api/auth/login`.
- Added avatar upload validation for JPG / PNG / WEBP only.
- Pinned backend and frontend dependency versions instead of using `latest`.
- Added environment-controlled cookie sameSite policy.
- CORS is stricter in production.
- Added pagination to `GET /api/trips`.
- Added Windows scripts.
- Added small UX clarity fixes:
  - `Still Needed` -> `Need to Save`.
  - `Available` -> `Ready Money`.
  - Auto-fix end date if it is before the start date.
  - Travelers `01` becomes `1` through update logic.
  - Expanded trip types for future suggestions.
- Added starter locale JSON files for EN / AR / ES.

## Still intentionally not migrated in this patch

These are important but must be separate migrations to avoid breaking v4.26:

1. Money storage: Float -> integer minor units or Decimal.
2. SQLite -> PostgreSQL.
3. Snapshot bridge removal from `Trip.notes`.
4. Email verification and password reset.
5. Billing / Paywall.
6. Full backend summary source-of-truth UI switch.
7. Full Finance CRUD UI integration.
8. Full test suite.

## Next recommended sprint

v4.27 — Backend Summary Source of Truth

- UI reads cards from `/api/trips/:id/summary`.
- Paid / Upcoming lists come from backend.
- Local calculation remains fallback only.
