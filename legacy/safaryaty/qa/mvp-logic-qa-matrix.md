# Safaryaty MVP Logic QA Matrix

## Objective

Validate source-of-truth correctness before adding new features.

## Rules

- Money sources affect readiness, not suggestion amounts.
- Trip cost suggestions estimate expenses, not affordability.
- Saved trips should prefer backend summary/payments/suggestions.
- Demo/draft can preview locally.
- One selected exchange rate must power all pages.

## Currency Scenarios

| ID | Setup | Expected | Must Not Happen |
|---|---|---|---|
| FX-01 | Base AED, Trip EGP, rate 14, savings 1000 AED | savings = 14000 EGP | divide by 14 |
| FX-02 | supportLocal 1000 EGP | support remains 1000 EGP | multiply support by 14 |
| FX-03 | base = trip AED, rate 99 | savings 1000 remains 1000 | use fake rate |
| FX-04 | Manual rate selected | all pages use manual | auto refresh overwrites manual |
| FX-05 | Auto rate selected | refresh updates rateUpdatedAt | pages use different rates |

## Suggestions Scenarios

| ID | Setup | Expected | Must Not Happen |
|---|---|---|---|
| SG-01 | Salary 100000 AED, no trip costs | suggestions stay based on duration/style | salary split into suggestions |
| SG-02 | New trip, no emergency selected | emergency visible in suggestions | emergency hidden |
| SG-03 | Add accommodation suggestion | moves to selected costs, opens, scrolls | duplicate card |
| SG-04 | Remove accommodation | returns to suggestions | stale selected item remains |
| SG-05 | Custom amount 8000 | selected cost amount = 8000 | recommended overwrites custom |
| SG-06 | Saved trip backend suggestion apply | backend creates/updates one TripCost | frontend + backend duplicate creation |

## Score Scenarios

| ID | Setup | Expected | Must Not Happen |
|---|---|---|---|
| SC-01 | Ready money 5x trip cost | coverage high | score stays low due to bad scaling |
| SC-02 | High money, no emergency | high-ish score, not perfect | fake 100 |
| SC-03 | Emergency added | safety factor improves | no score movement |
| SC-04 | Premium vs Balanced same numbers | Premium stricter | Premium easier than Balanced |

## Payments Scenarios

| ID | Setup | Expected | Must Not Happen |
|---|---|---|---|
| PY-01 | Add before-trip flight | payment row appears | hidden payment |
| PY-02 | Mark paid saved trip | backend summary refreshes | local-only paid state |
| PY-03 | Reload after paid | paid state persists | paid disappears |

## Manual QA Order

1. Create demo trip.
2. Fill route and dates.
3. Set AED → EGP with auto rate.
4. Add savings, salary, support.
5. Open destination suggestions.
6. Add emergency, accommodation, food.
7. Custom edit one suggestion.
8. Review KPIs.
9. Save/register.
10. Reload and re-open trip.
11. Mark one payment paid.
12. Reload again.
