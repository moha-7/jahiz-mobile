# External Provider Roadmap

## Phase 1 — Now

Local fallback providers only.

Use cases:

- planning estimate
- source/confidence display
- testable adapter structure

## Phase 2 — Countries

Backend sync of country metadata.

Fields:

- country code
- country name
- default currency
- region
- flag
- timezones
- languages

## Phase 3 — Currency

FX provider fallback chain:

1. current FX service
2. stale last-known rate
3. fallback estimate
4. manual user override

## Phase 4 — Cost Profiles

Admin-managed profiles by country:

- accommodation per day
- food per day
- transport per day
- activity range
- emergency minimum

## Phase 5 — Flight Estimates

Adapter interface supports:

- local fallback
- cached provider response
- source/confidence labels
- month/date ranges

Live booking prices are not part of MVP.
