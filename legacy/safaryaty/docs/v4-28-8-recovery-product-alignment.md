# Safaryaty v4.28.8 — Recovery + Product Alignment

This is a recovery sprint built from v4.28.6.1, not v4.28.7.

## Goals

- Restore the global KPI strip across pages.
- Keep the new readable tab names.
- Fix wizard scroll isolation and scroll-to-top behavior.
- Redesign the final review as a reward/decision screen, not a dense report.
- Keep Payments backend-first for saved trips and local preview only for demo/draft.
- Add faster Windows dev scripts so backend startup does not repeat setup every time.

## Core not touched

- engine.js
- payments.js
- canTravel.js
- currency logic
- installments logic
- backend schema

## New Windows scripts

- `scripts/setup-backend-windows.ps1` — one-time backend setup.
- `scripts/run-backend-dev-windows.ps1` — fast backend daily start.
- `scripts/run-frontend-dev-windows.ps1` — fast frontend daily start.

The old scripts still exist and remain safe.
