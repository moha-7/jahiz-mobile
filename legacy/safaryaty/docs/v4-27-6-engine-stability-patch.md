# Safaryaty v4.27.6 — Engine Stability Patch

## Goal

Integrate the handoff calculation engine as the frontend calculation source of truth, without changing the UI or removing any core feature.

## Integrated from handoff

- `src/engine.js`
- `src/engine.test.js`

## What changed

- Replaced the old inline frontend `calculate()` with the pure tested `engine.js` calculation.
- Replaced the old inline `recommendations()` with the engine recommendations.
- Preserved existing UI and data arrays:
  - `lifeCosts`
  - `installments`
  - `budget`
  - `paidPayments`
  - `scenario`
  - `rateBook`
- Installments remain core and were not removed.
- Monthly destination costs now multiply by trip months.
- Daily destination costs now multiply by trip days.
- One score is used: `readiness`.
- `miScore` now mirrors `readiness` so no score contradiction is introduced.
- Backend summary now includes a matching readiness/scoreFactors foundation and monthly TripCost totals for `MONTHLY` frequency.

## Acceptance run

```bash
node --test src/engine.test.js
npm run build
```

Result:

```txt
engine.test.js: 8/8 passing
frontend build: passing
```

## Known next step

`v4.27.7 — To Pay Engine Patch`

That sprint should integrate `patch/lib/payments.js` so monthly destination costs appear as scheduled payment occurrences in To Pay, not just as one total headline.
