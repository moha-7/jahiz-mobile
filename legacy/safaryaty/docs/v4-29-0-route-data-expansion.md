# Safaryaty v4.29.0 — Route Data Expansion

## What changed

- Expanded route country options from a small demo list to a larger curated travel list.
- Expanded airports from a few hardcoded airports to a broader offline fallback list.
- Kept all old countries and airports.
- Country labels now include flags.
- Airport labels now include IATA code, city, and airport name.
- Added a route data file:
  - `src/data/routeOptions.js`
- Added an optional updater script:
  - `scripts/update-route-data-from-ourairports.mjs`

## API / Data strategy

### Current production-safe approach

Use local curated data in `src/data/routeOptions.js` so the app works offline and does not depend on a third-party API during the user funnel.

### Recommended data source later

Use OurAirports open CSV data as the airport/country base, then curate the result before shipping.

Run manually:

```bash
node scripts/update-route-data-from-ourairports.mjs
```

This generates:

```txt
src/data/routeOptions.generated.js
```

Review it before replacing `routeOptions.js`.

## Why not call airport APIs directly from the browser?

- Airport datasets are large.
- Free APIs often have rate limits or keys.
- Route selection should be instant and reliable.
- Best approach: sync/update data in backend/build step, then serve curated data to the frontend.

## Future backend plan

Add backend endpoints:

```txt
GET /api/meta/countries
GET /api/meta/airports?country=DE
GET /api/meta/airports/search?q=dubai
```

Frontend should eventually read from backend metadata, with `routeOptions.js` as fallback.
