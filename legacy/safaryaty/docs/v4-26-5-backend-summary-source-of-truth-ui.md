# Safaryaty v4.26.5 — Backend Summary Source of Truth UI

## Goal

Start using the backend summary endpoint as the preferred source for financial cards and payment rows.

## Added

- The frontend calls `GET /api/trips/:id/summary` for saved non-guest trips.
- KPI cards prefer backend summary values when available:
  - Ready Money
  - Trip Plan Cost
  - Need to Save
  - Paid Already
- Payment Tracker prefers backend `payments.upcoming` and `payments.paid` when available.
- Local calculation remains as fallback for:
  - Guest demo mode
  - Backend unavailable
  - Unsaved draft
- Added a small source indicator:
  - Summary from backend
  - Loading backend summary
  - Local fallback

## Notes

This keeps the demo-first flow stable while moving the real app toward:

Backend = Source of Truth
Frontend = Display + Interaction

## Next

- Continue Finance CRUD APIs integration.
- Remove the snapshot bridge gradually after CRUD endpoints are fully connected.
