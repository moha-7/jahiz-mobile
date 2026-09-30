# Safaryaty v4.27.0 — Backend Summary Source of Truth Complete

## Goal

Make the backend summary the preferred source for the main decision layer when a trip is saved in the database.

## Done

- Trip status now prefers backend summary status when available.
- KPI cards already prefer backend `displayCards`.
- To Pay already prefers backend `payments`.
- Mark Paid / Undo already refresh backend summary when possible.
- Removed the fixed `3000` threshold from local trip status fallback.
- Event Management stays internal: it feeds To Pay, Summary, Warnings, and future Suggestions, with no standalone Events tab.

## Behavior

- Guest / Demo: local calculation engine works as fallback.
- Logged-in saved trip: backend summary is preferred.
- Backend unavailable: UI falls back safely to local calculation.

## Next Sprint

`v4.27.1 — Wizard Trip Purpose + Suggestions Foundation`

Trip setup should explicitly collect:

- Trip purpose
- Travel style
- Auto trip length
- Route
- Dates
- Travelers

These fields will feed the backend suggestions engine.
