# Safaryaty v4.29.42 — Recommendation Engine v1

## Goal

Turn the existing decision truth and Low/Typical/High cost ranges into a small number of useful, explainable actions.

The recommendation layer does **not** calculate money, readiness, FX, or cost ranges. It consumes those sources of truth.

## Canonical module

```txt
shared/recommendation-engine.js
```

Used by:

- frontend draft/local plans;
- backend saved-trip recommendation endpoint;
- Dashboard smart CTA;
- Recommendations page;
- Wizard review summary.

## Recommendation contract

Each item includes:

```txt
id
reasonCode
priority
level
title
detail
actionLabel
target
confidence
source
impact
categoryId
```

The engine returns no more than three actions by default.

## Priority order

1. Truth blockers: unconfirmed FX, missing trip costs.
2. Required-cost completeness.
3. Saving gap and negative cashflow.
4. Emergency safety.
5. Cost-range optimization.
6. Continuing installments and payment tracking.
7. Healthy-plan maintenance.

## Conflict prevention

- Rate blockers suppress range and budget advice.
- Missing trip costs suppress false financial intelligence.
- Only one cost-range adjustment is shown at a time.
- Recommendations that depend on an action disappear after the input is corrected.
- Ready plans do not receive contradictory “increase spending” and “cut spending” actions.

## Backend endpoint

```http
GET /api/trips/:tripId/recommendations
```

The endpoint:

1. verifies trip ownership;
2. calculates the canonical backend summary;
3. loads the destination cost-range envelope;
4. runs the shared recommendation engine;
5. returns recommendations plus source/confidence context.

## UI behavior

- The first recommendation becomes the Smart CTA in the decision card.
- `Improve Plan` remains a separate full-Wizard action.
- Recommendation cards show priority, confidence, source, estimated impact and an exact deep link.
- Saved trips prefer backend recommendations; local shared-engine output is the immediate fallback.

## Out of scope

- ML or LLM decision-making.
- Persisting recommendation telemetry.
- Schema changes.
- Flight estimate recommendations.
