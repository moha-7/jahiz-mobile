# v4.29.52 — Suggestion Currency Parity Checklist

Run this before starting PostgreSQL Docker staging.

## Bahrain reproduction

1. Open a Bahrain trip using BHD as Trip Currency.
2. Record:
   - Low
   - Typical
   - High
   - every visible suggestion amount
   - selected-cost total
3. Change Trip Currency from BHD to AED through Currency Setup.
4. Return to Trip Costs.

Expected:

- currency labels become AED;
- numeric suggestion/range amounts also change;
- values are approximately the original BHD values multiplied by the saved BHD→AED rate;
- `870 BHD` must never become `870 AED`;
- selected costs, suggestions and range totals agree on AED;
- no suggestion appears twice.

## Round trip

1. Change BHD → AED.
2. Record values.
3. Change AED → BHD.

Expected:

- economic values return within planning-rounding tolerance;
- no repeated multiplication;
- no double conversion;
- selected TripCost IDs and PaymentMark state remain unchanged.

## Saved trip refresh

After BHD → AED:

1. hard refresh;
2. log out/in;
3. reopen the trip;
4. reopen Improve Plan → Trip Costs.

Expected:

- suggestions remain in AED;
- ranges remain in AED;
- no temporary BHD number with an AED label;
- backend and local fallback produce equivalent currency direction.

## Provider/network failure

Temporarily make the cost-profile/FX request unavailable while keeping a valid saved trip rate.

Expected:

- local estimates use the saved `rateBook`;
- the UI does not relabel native numbers;
- if neither API nor saved rate exists, converted suggestions are not shown as valid target-currency values.

## Recommendation parity

Check the Recommendations tab after each currency switch.

Expected:

- below-range/above-range advice uses the same converted ranges shown in Trip Costs;
- a recommendation does not compare AED selected costs against nominal BHD ranges.
