# v4.29.46 — Trip Costs & Suggestions Manual QA

Record PASS/FAIL and evidence for every P0/P1 item before release.

## A. Suggestion identity and duplicates

| ID | Priority | Steps | Expected |
|---|---:|---|---|
| SUG-01 | P0 | Double-click Add on Food rapidly | One selected Food suggestion cost only |
| SUG-02 | P0 | Press Add essentials twice | No duplicate selected costs or backend rows |
| SUG-03 | P0 | Add manual Food cost, then apply Food suggestion | Manual cost remains unchanged; suggestion-owned cost is separate or reconciled intentionally |
| SUG-04 | P1 | Refresh after applying suggestions | Same accepted/PENDING state, no regenerated duplicates |
| SUG-05 | P1 | Remove an accepted suggestion | Its suggestion-owned cost is removed and the card returns to Suggestions |
| SUG-06 | P1 | Remove then add again | Exactly one accepted suggestion cost |
| SUG-07 | P0 | Add Emergency suggestion repeatedly | One suggestion-owned Emergency cost only |
| SUG-08 | P1 | Change dates/travelers then refresh suggestions | Existing confirmed amounts remain; estimates refresh without duplication |

## B. Frequency truth

| ID | Priority | Steps | Expected |
|---|---:|---|---|
| COST-01 | P0 | Add 200/day for a 10-day trip | Trip Plan Cost contribution = 2,000; one payment row says 10 days |
| COST-02 | P0 | Change trip to 15 days | Daily contribution becomes 3,000 without changing unit amount 200 |
| COST-03 | P0 | Monthly cost due Jan 31, trip Jan 31–Mar 1 | Actual due-date occurrences are used; frontend/backend totals agree |
| COST-04 | P1 | Weekly cost across 20 days | Due-date weekly occurrences are correct |
| COST-05 | P1 | Yearly cost outside/inside trip range | Counted only when an occurrence falls in range |
| COST-06 | P1 | One-time and trip-total costs | Each counted exactly once |

## C. Categories and lifecycle

| ID | Priority | Steps | Expected |
|---|---:|---|---|
| CAT-01 | P0 | Existing legacy `Food & Cafes`, regenerate suggestions | Recognized as `cat-food`; no duplicate from label mismatch |
| CAT-02 | P0 | Existing `Transportation`, regenerate | Recognized as `cat-transport` |
| CAT-03 | P1 | Add two custom accommodation entries | Both allowed and retained |
| CAT-04 | P1 | Apply one accommodation suggestion | Manual accommodation entries are not overwritten |
| CAT-05 | P1 | Delete a custom cost | Suggestion state is unaffected |

## D. Currency and ranges

| ID | Priority | Steps | Expected |
|---|---:|---|---|
| FX-01 | P0 | Trip currency BHD, open suggestions | Amounts are BHD-scale; no hard-coded 2,200 AED/EGP minimum |
| FX-02 | P0 | Switch Display Currency | Stored suggestion/cost amounts and statuses do not change |
| FX-03 | P0 | Change canonical Trip Currency through Currency Setup | Values convert once; suggestions/ranges use the new Trip Currency |
| FX-04 | P1 | Provider unavailable | Local range fallback is clearly estimated and does not duplicate costs |

## E. Persistence and cross-page truth

| ID | Priority | Steps | Expected |
|---|---:|---|---|
| DATA-01 | P0 | Apply suggestion, hard refresh, logout/login | Accepted cost and suggestion state persist once |
| DATA-02 | P0 | Compare Dashboard, Trip Costs, Trip Payments | Same effective cost totals |
| DATA-03 | P0 | Mark a daily/monthly cost occurrence paid | Paid/Still To Pay change; Trip Plan Cost and affordability stay stable |
| DATA-04 | P1 | Undo paid, reload | Only selected occurrence is restored |
| DATA-05 | P1 | Remove accepted suggestion while request is slow | Button shows pending state and cannot trigger a second request |

## Golden path

1. Create a 10-day trip in a non-AED currency.
2. Generate suggestions.
3. Apply Flight, Accommodation, Food, Transport, Gifts, and Emergency.
4. Double-click one Add button intentionally.
5. Add a second custom Accommodation cost.
6. Set Food to DAILY and verify total/payment aggregation.
7. Remove Food suggestion and confirm it returns.
8. Add it again.
9. Mark one monthly/daily tracked payment paid.
10. Switch Display Currency, refresh, logout/login.
11. Compare Dashboard, Trip Costs, Payments, and Review.

**Pass:** no duplicate suggestion-owned costs, manual costs remain intact, totals agree, payment state persists, and all values remain in the canonical Trip Currency internally.
