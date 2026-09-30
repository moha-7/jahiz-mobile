# v4.29.44 — Finance Truth Manual QA

Use one saved trip with:

- one monthly bill;
- one installment;
- one one-time trip cost;
- one monthly or daily trip cost;
- valid savings, income and FX rate.

Record these before every action:

```txt
Ready Money
Trip Plan Cost
Paid So Far
Still To Pay
Need To Save
After-Trip Position
Readiness / Verdict
```

## Scenario 1 — initial unpaid plan

Expected:

- Paid So Far = 0
- Still To Pay = Total Tracked Outgoings
- Paid + Still = Total Tracked

## Scenario 2 — mark one payment paid

Expected:

- Paid So Far increases by exactly that occurrence;
- Still To Pay decreases by exactly that occurrence;
- Ready Money does not change;
- Trip Plan Cost does not change;
- Need To Save does not change;
- After-Trip Position does not change.

## Scenario 3 — mark every occurrence paid

Expected:

- Still To Pay = 0;
- Paid So Far = Total Tracked Outgoings;
- affordability KPIs remain the same as the initial plan.

## Scenario 4 — undo one payment

Expected:

- one occurrence returns to upcoming;
- Paid decreases once;
- Still increases once;
- affordability remains unchanged.

## Scenario 5 — reload and login persistence

After marking payments:

1. hard refresh;
2. log out and in;
3. reopen the same trip.

Expected: payment progress and all ledger invariants remain correct.

## Scenario 6 — display currency

Switch Dashboard display between Trip / Income / USD / EUR.

Expected:

- only displayed values change;
- paid state remains;
- stored plan and payment rows do not change;
- ledger equation remains true in every displayed currency.

## Scenario 7 — one-time occurrence keys

Mark one-time Life Cost and one-time Trip Cost paid, refresh, then undo.

Expected: no duplicate or lost state caused by `life-id` versus `life-id-0` or `cost-id` versus `cost-id-0`.

## Scenario 8 — UI buttons

Expected:

- Recommended Fix opens the exact page/card;
- Improve Plan opens the full Wizard;
- keyboard focus is visible;
- disabled and loading buttons remain understandable;
- toasts are short and do not mention backend sync or provider internals.
