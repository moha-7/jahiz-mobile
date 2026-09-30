# v4.29.17 — Emergency Quick Add inside Suggestions

## Scope

Small UX + suggestion safety improvement on top of v4.29.16.

## Changes

- Added an Emergency quick-add strip inside Destination Budget Builder.
- Emergency can now be added quickly as:
  - Recommended amount
  - 5% buffer
  - 10% buffer
- If Emergency is already selected, the strip changes to "Open emergency card".
- Add essentials now adds true essentials only:
  - Flights
  - Accommodation
  - Emergency
- Emergency suggestion is pinned to the top of the suggestions list when still available.
- Backend suggestion template now keeps Emergency meaningful for Comfortable/Premium instead of becoming too small.

## Protected

- No API contract changes.
- No Prisma schema changes.
- No currency API changes.
- No score formula changes.
- No payment source-of-truth changes.

## Note

Direct finance create sync already exists for added trip costs. This patch keeps that behavior and improves the UX around the emergency category.
