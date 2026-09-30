# Safaryaty v4.29.26 — Trip Cost Sync Hotfix + Country Coverage

## Fixed

- Trip cost direct backend create now accepts `status` and `paidDate`, matching the frontend payload.
- This fixes backend sync failure where Trip Costs/Suggestions could stay local and Money Out only reflected commitments.
- Trip cost create now returns a refreshed backend summary when available.
- Frontend sync failure toast now shows the real backend error message.

## Country/Currency coverage

- Added Georgia (GEL), Armenia (AMD), and Azerbaijan (AZN) to route options, airports, country metadata, and cost profiles.
- Added destination currency notice in Trip Costs so users know the destination default currency and selected Trip Currency.

## Protected

- No FX conversion changes.
- No Prisma schema changes.
- No payment source-of-truth changes.
- No score formula changes.
