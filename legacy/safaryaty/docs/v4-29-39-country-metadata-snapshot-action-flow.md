# v4.29.39 — Country Metadata Snapshot + Action Flow

## Product action fix

The decision card now exposes two intentionally separate controls:

- **Primary CTA** follows the canonical deep link from `nextAction.target`.
- **Improve Plan** always opens the full wizard for broad editing.

The Travel Coach card follows the same rule. A generic Improve Plan action no longer replaces or hijacks the contextual CTA.

## Country metadata foundation

- Added `ExternalDataSnapshot` to Prisma.
- Added a persistent snapshot service with fresh/stale detection and last-known-good behavior.
- Added a REST Countries adapter behind environment configuration.
- Added a bundled local fallback.
- Added a request-level refresh lock.
- `GET /api/external/countries` serves a fresh snapshot, stale snapshot, or local fallback.
- `GET /api/external/countries/:code` resolves a single country from the same source.
- `POST /api/external/countries/sync` is protected by authentication and admin permission.
- Admin Console can view snapshot source/freshness and force a sync.

## Environment

```env
REST_COUNTRIES_BASE_URL=https://restcountries.com/v3.1
REST_COUNTRIES_API_KEY=
COUNTRY_METADATA_TTL_HOURS=168
```

The base URL is configurable so provider versions can change without rewriting the product layer.

## Source-of-truth decisions

- Backend snapshot is the runtime source for external country metadata.
- Bundled frontend/adapter country data remains a resilience fallback.
- OurAirports remains the airport dataset and is not replaced by this sprint.
- Redis and worker scheduling remain deferred.

## Migration

Run:

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run build
```

The included migration creates `ExternalDataSnapshot`.

## Manual QA

1. Confirm the decision card primary CTA opens the correct page/card.
2. Confirm Improve Plan opens the wizard independently.
3. Call `GET /api/external/countries` twice; the second response should come from the snapshot once synced.
4. As admin, press Force sync in Admin Console.
5. Stop provider access and confirm the last snapshot or bundled fallback is served with `stale: true`.
6. Confirm a normal user cannot call the force-sync endpoint.
