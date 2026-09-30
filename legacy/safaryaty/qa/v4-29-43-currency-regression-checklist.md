# v4.29.43 — Currency Regression Checklist

Record PASS/FAIL and evidence for every P0/P1 test.

## P0 — display must never mutate finance

### CUR-01 Paid state survives display switch

1. Create a saved trip with at least three recurring payment occurrences.
2. Mark one occurrence paid.
3. Note Paid So Far, Still To Pay, payment title/date and Trip Plan Cost.
4. Switch display through trip currency, income currency, USD and EUR.
5. Refresh and log out/in.

Expected:

- exactly the same occurrence remains paid;
- Paid So Far and Still To Pay are economically identical, only displayed currency changes;
- Trip Plan Cost does not change economically;
- no duplicate payment or cost appears.

### CUR-02 Unsupported display pair

Request a display currency for which no rate is available.

Expected:

- the UI falls back to trip currency or shows an unavailable state;
- it never displays the same raw number under a different currency label.

## P0 — actual plan currency change

### CUR-03 Trip currency conversion

1. Create costs and support in the current trip currency.
2. Mark one payment occurrence paid.
3. Change the trip currency centrally from Available Money.
4. Confirm conversion.
5. Compare before/after economic values and reload.

Expected:

- trip costs and support convert once;
- finance row IDs and paid occurrence remain stable;
- no full finance snapshot recreation;
- no duplicate costs;
- canonical totals agree across Dashboard, Trip Costs, Payments and Review.

### CUR-04 Income currency conversion

Change income currency after entering savings, reserve, incomes, life costs and installments.

Expected:

- all income-side amounts convert once;
- trip-side amounts do not convert unless trip currency also changes;
- score/verdict do not materially jump from a raw-number copy error.

### CUR-05 Currency pair change

Change income and trip currencies together.

Expected:

- income-side and trip-side values use their own resolved conversion rates;
- the new planning rate is `new income → new trip`;
- no field is converted twice.

## P0 — route integration

### CUR-06 Destination change

Change destination to a country with a different currency.

Expected:

- the same atomic currency-context flow runs;
- route and currency save together;
- display currency does not reset when the actual trip currency remains unchanged;
- when trip currency changes, the new trip currency becomes the safe default display.

### CUR-07 Route change without currency change

Change airport/country while keeping the same currency.

Expected:

- no financial amount changes;
- selected display currency remains;
- PaymentMark rows remain.

## P1 — rate control

### CUR-08 Automatic rate refresh

Refresh an automatic planning rate.

Expected:

- provider source/as-of/confidence update;
- finance rows are not deleted/recreated;
- stored amounts stay in their natural currencies;
- calculations use the new planning rate once.

### CUR-09 Manual rate

Activate manual override, reload and allow automatic polling/refresh conditions.

Expected:

- manual rate is not overwritten until automatic mode is restored;
- display rates remain independent from the planning rate.

### CUR-10 Provider unavailable

Use a previously cached rate, then make providers unavailable.

Expected:

- last-known-good snapshot is used and labelled stale;
- calculations remain deterministic;
- no silent `1:1` cross-currency conversion.

## P1 — creation and persistence

### CUR-11 New draft before backend ID

Change currency while creating a new draft.

Expected:

- local shared-domain conversion works;
- saving the draft does not convert a second time;
- saved/backend summary matches draft totals.

### CUR-12 Hard persistence test

After CUR-03/CUR-04:

1. hard refresh;
2. close/reopen browser;
3. log out/in;
4. reopen trip.

Expected:

- currencies, rates, converted values and paid marks remain exactly as saved.

## Cross-page sign-off

For one complex trip, compare:

- Dashboard
- Available Money
- Commitments
- Trip Costs
- Trip Payments
- Review
- Saved backend summary

Expected:

```txt
Ready Money
Trip Plan Cost
Paid So Far
Still To Pay
Need to Save
Readiness/Verdict
```

must describe one economically equivalent plan in every selected display currency.
