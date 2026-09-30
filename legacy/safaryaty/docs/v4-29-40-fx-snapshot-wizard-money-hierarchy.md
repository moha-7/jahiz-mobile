# v4.29.40 — FX Provider Resolver + Available Money Hierarchy

## Scope

This sprint implements the planned persistent FX resolver and includes the requested Available Money wizard cleanup. It does not change the canonical score/verdict, Prisma schema, payment truth, or trip-cost calculations.

## FX resolver

Provider order:

1. Frankfurter v2
2. open.er-api
3. Fawaz CDN/pages
4. static emergency fallback

Rates are stored in the existing `ExternalDataSnapshot` model by base currency. The API serves fresh snapshots first, last-known-good stale snapshots during provider failure, and emergency fallback only when no snapshot is available.

The response includes:

- `source`
- `sourceAsOf`
- `fetchedAt`
- `expiresAt`
- `stale`
- `confidence`

Manual trip rates stay protected because automatic refresh runs only in `AUTO` mode. Editing the rate manually switches the trip to `MANUAL` mode.

## Wizard cleanup

The Available Money step now follows this hierarchy:

1. Savings and support — always visible
2. Safety reserve — compact
3. Currency, rate and display — collapsible advanced section
4. Money In presets and cards

Comfort Level moved back to Trip Details. Long guidance copy in wizard managers is hidden behind “What counts here?”.

## Environment

```env
FRANKFURTER_BASE_URL="https://api.frankfurter.dev"
FX_RATE_TTL_HOURS=24
```

## Manual QA

1. Open Step 2 and confirm savings/support are visible without scrolling through currency setup.
2. Confirm Currency & display is collapsed unless the rate needs review.
3. Expand it, change the pair and refresh; verify source/freshness text.
4. Enter a manual rate, close/reopen Step 2 and confirm automatic refresh does not overwrite it.
5. Stop internet access after one successful rate fetch and confirm the saved snapshot is returned as stale.
6. Switch display currency and confirm stored amounts and paid state do not change.
