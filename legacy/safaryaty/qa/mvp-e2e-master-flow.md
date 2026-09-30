# v4.29.28 — MVP End-to-End Master Flow QA

## Purpose

This file is the manual QA pass before adding bigger external APIs, Docker workers, or recommendation intelligence.

## Golden flow

1. Register or login.
2. Create a saved trip.
3. Choose route and dates.
4. Choose income currency and trip currency.
5. Confirm auto FX rate or set manual rate.
6. Add money in: savings, salary, support.
7. Add trip costs from suggestions: flight, accommodation, food, transport, emergency.
8. Verify Trip Plan Cost updates.
9. Verify Ready Money / Need to Save / Left after trip update.
10. Verify score explanation mentions Coverage, Safety, Timing, Confidence.
11. Go to Trip Payments and mark one item paid.
12. Reload browser.
13. Verify saved costs and paid state remain.
14. Remove one selected trip cost.
15. Verify it disappears locally and backend delete does not show scary errors if already removed.

## Must pass

- Trip costs affect Trip Plan Cost.
- Trip costs affect score.
- Trip costs affect payments.
- Trip costs survive refresh for saved trips.
- Need to Save can be zero while Safety still warns if leftover is low.
- Currency change converts trip-local amounts instead of keeping the old number.
- Support money is trip currency and does not double convert.
- Salary/current savings stay in income/base currency.
- Suggestions never use salary/savings/available cash as suggestion source.

## Known external-data boundary

External APIs for flights/hotels are not part of this QA pass. Currency FX exists; country/cost profile data exists; live travel market APIs come later.
