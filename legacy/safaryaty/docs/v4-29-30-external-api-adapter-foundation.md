# Safaryaty v4.29.30 — External APIs Adapter Foundation

## Purpose

Prepare the system for real external data without connecting heavy live APIs directly to the UI.

## Rule

Frontend must not call external APIs directly.

External data flow:

```txt
External provider
→ backend adapter
→ cache / database snapshot
→ suggestion engine / summary engine
→ UI
```

## Added foundation

### Frontend-safe definitions

```txt
src/data/externalDataAdapters.js
src/externalDataAdapters.test.js
```

These define shared concepts only:

- data envelope
- confidence level
- refresh policy
- currency pair key
- flight estimate cache key
- safe flight fallback

### Backend adapter interfaces

```txt
backend/src/modules/external/types.ts
backend/src/modules/external/cache.ts
backend/src/modules/external/countryMetadata.adapter.ts
backend/src/modules/external/costProfile.adapter.ts
backend/src/modules/external/flightEstimate.adapter.ts
backend/src/modules/external/index.ts
```

## What this does not do yet

- No live ticket pricing.
- No new external API calls from frontend.
- No schema migration.
- No production worker yet.
- No Docker changes yet.

## Why

This keeps the MVP stable while making the next steps clean:

1. country metadata sync
2. cost profile expansion
3. flight estimate provider
4. worker/cache/Docker
