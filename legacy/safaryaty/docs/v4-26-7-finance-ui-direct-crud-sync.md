# Safaryaty v4.26.7 — Finance UI Direct CRUD Sync

## Goal

Start moving the frontend finance actions from snapshot-only sync to direct backend CRUD, while keeping the current snapshot bridge as fallback.

## Added

- Add finance item now tries direct API create when the trip is saved in backend.
- Edit finance item now tries direct API update if the row already has a backend ID.
- Delete finance item now tries direct API delete if the row already has a backend ID.
- After direct finance changes, the UI refreshes backend summary.
- Guest/demo mode still uses local-only fallback.
- Snapshot bridge remains active for old rows without backend IDs.

## Direct endpoints used

- `POST /api/trips/:tripId/incomes`
- `POST /api/trips/:tripId/life-costs`
- `POST /api/trips/:tripId/installments`
- `POST /api/trips/:tripId/costs`
- `PATCH /api/:model/:id`
- `DELETE /api/:model/:id`
- `GET /api/trips/:tripId/summary`

## Why this is safe

This does not remove the current snapshot system yet. It only adds a direct CRUD layer for new/known backend rows, so we can migrate gradually.

## Next

v4.26.8 should map backend finance rows back into frontend items after loading a trip, so more existing items get `backendId` and can be edited directly.
