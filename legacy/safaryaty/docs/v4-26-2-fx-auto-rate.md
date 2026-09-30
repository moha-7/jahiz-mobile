# Safaryaty v4.26.2 — FX Auto Rate Patch

## Goal

Reduce manual currency input and keep manual override available.

## Added

- Backend FX service with 6-hour in-memory cache.
- Backend endpoint:
  - `GET /api/fx/rate?from=AED&to=EGP`
- Providers order:
  1. `open.er-api.com`
  2. `fawazahmed0/currency-api` CDN fallback
  3. small fallback estimates for common test pairs if providers are unavailable
- Frontend `api.getRate(from, to)` helper.
- Wizard Money step now auto-fetches a rate when the currency pair changes and rate needs review.
- Manual rate remains available and has priority when user edits it.

## Why backend endpoint?

- Avoids frontend CORS issues.
- Allows caching.
- Keeps provider changes inside the server.
- Makes it easy to add keys or paid providers later without exposing them.

## Manual override rule

Auto rate gives a suggested market rate. The user can still edit the manual rate if their real exchange rate is different.
