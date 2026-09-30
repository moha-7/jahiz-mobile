# v4.29.27 QA — Tight Plan / Score Explanation

## Scenario 1 — Covered but tight
- Ready Money: 4,770 GEL
- Trip Plan Cost: 4,710 GEL
- Left after trip: 60 GEL

Expected:
- Need to Save = 0
- Decision = You can take this trip, but it is tight
- KPI note shows low safety buffer
- Score breakdown explains Coverage / Safety / Timing / Confidence

## Scenario 2 — Healthy buffer
- Ready Money: 8,000 GEL
- Trip Plan Cost: 4,710 GEL
- Emergency exists

Expected:
- Decision should move toward Ready / Almost ready
- Safety factor improves

## Scenario 3 — Delete already removed
- Remove a selected Trip Cost that backend no longer has.

Expected:
- No scary error
- Toast: Item was already removed. Plan refreshed.
- Summary refreshes
