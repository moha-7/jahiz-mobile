# v4.26.9 — Event Management UI Panel

## Added

- New `events` tab in the main app.
- Event Management panel with four groups:
  - Upcoming
  - Paid
  - Income
  - Warnings
- Uses backend `summary.events` when available.
- Uses backend `summary.payments` as payment events when available.
- Falls back to local cashflow for demo/guest mode or when backend events are not ready.

## Goal

This is the first UI layer for the financial event-management system. It does not replace To Pay yet; it adds a timeline view that will become the base for future reminders, warnings, and smarter suggestions.
