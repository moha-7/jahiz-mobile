# v4.29.41 — Country Cost Ranges + Dashboard Clarity

## Scope

This sprint implements Country Cost Ranges v1 and includes the requested UI cleanup without changing the canonical decision engine, payment truth, or Prisma schema.

## Dashboard

- Replaced repetitive KPI presentation with a money snapshot:
  - Ready Money
  - Trip Plan Cost
  - Paid So Far
  - Still To Pay
- Added a funding-status strip for Need to Save or expected after-trip money.
- Removed duplicate top-advice and duplicate number cards from Dashboard.
- Quick Edit is collapsed until needed.
- The smart deep-link action and Improve Plan are visually and verbally separated.

## Wizard Trip Costs

- Added a Trip Cost Currency selector using all supported currencies.
- Added Use Destination Currency.
- Existing trip costs are converted only after the new FX rate is confirmed through the existing guarded conversion flow.
- Rate review is available inside the Trip Costs step.

## Cost Ranges v1

- Each category now has Low / Typical / High values.
- Ranges account for destination, duration, travelers, and comfort.
- Results include currency, unit, confidence, source, assumptions, and total range.
- Added public backend endpoint:

```http
GET /api/external/cost-profile?country=EG&currency=EGP&comfort=Balanced&days=10&travelers=2
```

- Frontend uses the backend range envelope when available and a local safe fallback otherwise.
- Ranges are planning estimates, not booking prices.

## Protected

- No Prisma schema change.
- No score/verdict rewrite.
- No payment or PaymentMark rewrite.
- No live booking API.
- Salary, savings, support, and available cash never affect cost-range estimates.
