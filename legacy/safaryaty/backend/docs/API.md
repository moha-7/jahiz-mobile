# Safaryaty Backend API — Sprint 2.1

Base URL:

```text
http://127.0.0.1:4000/api
```

## Health

```http
GET /api/health
```

## Auth

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
PATCH /api/auth/profile
PATCH /api/auth/password
POST /api/auth/avatar
```

Session is stored in an HttpOnly cookie named `safaryaty_session`. For development, Bearer token support also exists internally if needed.

## Trips

```http
GET    /api/trips
GET    /api/trips?status=DRAFT
POST   /api/trips
GET    /api/trips/:tripId
PATCH  /api/trips/:tripId
PATCH  /api/trips/:tripId/status
POST   /api/trips/:tripId/finish
DELETE /api/trips/:tripId
GET    /api/trips/:tripId/summary
```

Trip statuses:

```text
DRAFT
ACTIVE
ARCHIVED
DELETED
```

## Finance Items

```http
POST /api/trips/:tripId/incomes
POST /api/trips/:tripId/life-costs
POST /api/trips/:tripId/installments
POST /api/trips/:tripId/costs
POST /api/trips/:tripId/expenses
```

## Mark Paid

```http
PATCH /api/costs/:id/mark-paid
PATCH /api/costs/:id/undo-paid
PATCH /api/installments/:id/mark-paid
PATCH /api/installments/:id/undo-paid
```

Due date never marks a cost/installment as paid automatically. Only `mark-paid` changes status.

## Suggestions

```http
POST /api/trips/:tripId/suggestions/generate
GET  /api/trips/:tripId/suggestions
POST /api/suggestions/:id/apply
POST /api/suggestions/:id/ignore
```

Preset suggestions do not mutate the plan automatically. Applying a suggestion is explicit.

## Canonical trip recommendations

```http
GET /api/trips/:tripId/recommendations
```

Returns up to three ranked, explainable actions generated from the canonical saved-trip decision, payment schedule, and destination cost ranges. The endpoint requires authentication and trip ownership.

Response fields include:

```txt
version
recommendations[].reasonCode
recommendations[].priority
recommendations[].confidence
recommendations[].source
recommendations[].impact
recommendations[].target
context.costProfile
context.decisionVersion
```

## Normalized trip finance profile — v4.29.49

Trip create and patch payloads may include:

```json
{
  "financeProfile": {
    "startingSavings": 1400,
    "supportMoney": 0,
    "safetyReserve": 500,
    "reserveEnabled": true,
    "returnWithZero": false,
    "rateBookJson": "{\"AED_EGP\":13.6}",
    "schemaVersion": 1
  }
}
```

During the transition, the server dual-reads and dual-writes the normalized profile and legacy `Trip.notes` snapshot. The normalized profile is authoritative when present.
