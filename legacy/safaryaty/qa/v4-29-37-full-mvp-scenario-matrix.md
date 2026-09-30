# Safaryaty v4.29.37 — Full MVP Scenario Matrix

## Release rule

The release is approved only when:

- all automated tests and the production build pass;
- every P0/P1 scenario below passes;
- no saved-trip amount changes merely because the display currency changes;
- paid/undo state survives reload and display-currency switches;
- saved-trip Dashboard/Payments/Trip Costs agree on totals.

Use a fresh browser profile for the new-user scenarios and a normal profile for persistence scenarios.

---

## A. Authentication and ownership

| ID | Priority | Scenario | Steps | Expected |
|---|---:|---|---|---|
| AUTH-01 | P1 | Register new user | Register with valid data, then open app | User enters own empty workspace; no other user's data appears |
| AUTH-02 | P1 | Login/logout | Log out, log back in | Same user's trips return; session works |
| AUTH-03 | P0 | Ownership isolation | Attempt to open another trip ID if available | Access denied/not found; no foreign finance rows exposed |
| AUTH-04 | P2 | Validation | Submit missing/invalid required fields | Clear field-level message; no broken record created |

## B. First-trip creation

| ID | Priority | Scenario | Steps | Expected |
|---|---:|---|---|---|
| TRIP-01 | P1 | Create basic trip | Choose origin, destination, start/end dates, travelers | Trip saves and opens; route/date summary matches inputs |
| TRIP-02 | P1 | Date validation | Set end before start or an invalid date | Save blocked with clear message |
| TRIP-03 | P1 | Route filtering | Select a country then airport | Only relevant country/region airports shown; selected route collapses cleanly |
| TRIP-04 | P2 | Reopen/edit trip details | Edit dates from Quick Edit/page flow | Saved trip updates without rebuilding unrelated finance rows |

## C. Currency truth

| ID | Priority | Scenario | Steps | Expected |
|---|---:|---|---|---|
| FX-01 | P0 | Base to trip conversion | Base AED, trip USD, add AED savings/income | Trip-currency totals use actual rate; AED value is not copied as USD |
| FX-02 | P0 | Display-only switch | Mark a payment paid, then switch display USD/AED/EUR | Only displayed values change; paid marks and stored amounts remain |
| FX-03 | P0 | Trip currency change | Add trip-local costs, then change trip currency | Existing trip-local values convert to equivalent value, not same raw number |
| FX-04 | P1 | Manual override | Enter manual FX rate, wait/refresh | Manual rate remains until user restores automatic mode |
| FX-05 | P0 | Support money | Add support in trip currency | Added exactly once; no double conversion |
| FX-06 | P1 | Same currency | Base and trip currencies identical | Amount remains unchanged regardless of stale exchangeRate value |
| FX-07 | P1 | Global benchmark options | Select trip currency, income currency, USD and EUR display options | Options are clear; USD/EUR work as display benchmarks only |

## D. Money and commitments

| ID | Priority | Scenario | Steps | Expected |
|---|---:|---|---|---|
| MONEY-01 | P1 | Savings and support | Add/update current savings and support in Quick Edit | Ready Money and Need to Save update correctly |
| MONEY-02 | P1 | Salary occurrence | Add monthly salary with payday crossing trip window | Only real due-date occurrences count |
| MONEY-03 | P1 | One-time income date | Add bonus after trip end | It does not improve trip readiness before travel |
| COMMIT-01 | P1 | Monthly bill | Add monthly bill due in planning window | Appears in Commitments and Trip Payments once per real occurrence |
| COMMIT-02 | P1 | Installment | Add Tabby/Tamara/card installment | Correct number of installments appears; no duplicates |
| COMMIT-03 | P1 | Continuing commitment | Add installment continuing after return | In-window payments count; continuing risk is explained separately |
| COMMIT-04 | P2 | A/B sections | Open Commitments | Monthly Bills and Installments are visibly separated and editable |

## E. Trip costs and suggestions

| ID | Priority | Scenario | Steps | Expected |
|---|---:|---|---|---|
| COST-01 | P0 | One-time cost | Add flight/accommodation total | Trip Plan Cost, Money Out and score update consistently |
| COST-02 | P0 | Daily cost | Add 200/day for 10 days | Saved/backend total is 2,000, not 200 |
| COST-03 | P0 | Monthly cost | Add monthly cost with due date across date range | Count equals actual due-date occurrences, not calendar inflation |
| COST-04 | P1 | Suggestion basket | Add suggestion | Moves to selected costs and disappears from suggestions |
| COST-05 | P1 | Remove selected | Remove a selected suggested cost | Returns to suggestions without duplication |
| COST-06 | P1 | Custom amount | Override suggestion amount and save | Exact custom amount persists after reload |
| COST-07 | P1 | Emergency | Start without emergency | Emergency is suggested; only opens automatically after a direct action/add/edit |
| COST-08 | P1 | Category reconciliation | Add legacy/current Food or Transport categories | No duplicate caused by label/ID differences |
| COST-09 | P2 | Default collapse | Open Trip Costs normally | Cards are collapsed by default; no stale deep-link card stays open |

## F. Payments and paid state

| ID | Priority | Scenario | Steps | Expected |
|---|---:|---|---|---|
| PAY-01 | P0 | Payment coverage | Open Trip Payments | Trip Costs, Monthly Bills and Installments appear where due |
| PAY-02 | P0 | Mark one recurring occurrence | Mark first of 3 installments paid | Only selected occurrence becomes Paid |
| PAY-03 | P0 | Reload persistence | Mark paid, hard refresh/relogin | Paid state and Paid Already persist |
| PAY-04 | P0 | Display switch persistence | Mark paid, switch display currency | Paid state and Paid Already do not reset to zero |
| PAY-05 | P1 | Undo | Undo a paid occurrence | Only selected occurrence returns to upcoming; totals update |
| PAY-06 | P1 | Delete reconciliation | Delete item, repeat/refresh | No scary error; missing item treated as already removed |
| PAY-07 | P1 | No duplicates | Inspect recurring rows | Same occurrence does not appear twice |

## G. Decision, score and guidance

| ID | Priority | Scenario | Steps | Expected |
|---|---:|---|---|---|
| SCORE-01 | P0 | Cost affects score | Increase Trip Cost materially | Need to Save/score/verdict react |
| SCORE-02 | P1 | Tight plan | Ready Money barely exceeds Trip Plan Cost | “Can go, but tight”/orange state and low leftover warning |
| SCORE-03 | P1 | Risky plan | Create clear shortfall | Risky/blocked decision and useful next action |
| SCORE-04 | P1 | Ready plan | Strong coverage, reserve and timing | Ready state; current state only, no full colored legend |
| SCORE-05 | P1 | Need to Save zero with weak buffer | Cover cost but leave minimal balance | Shows no gap plus safety warning, not falsely perfect |
| SCORE-06 | P1 | Saved/draft parity | Compare before and after save | Material totals/verdict do not jump unexpectedly |
| SCORE-07 | P1 | Two-currency explanation | View Dashboard | Main trip-currency amount plus understandable approximate display/base amount |
| SCORE-08 | P0 | Draft/saved canonical decision | Record score/verdict before save, save and refresh | Readiness, four factor scores, verdict and reason remain identical |

## H. Deep links and edit flow

| ID | Priority | Scenario | Steps | Expected |
|---|---:|---|---|---|
| ACTION-01 | P1 | Add emergency action | Press coach action | Opens Trip Costs, scrolls to Emergency and opens once |
| ACTION-02 | P1 | Open payments action | Press payment advice | Opens Trip Payments with useful context/filter |
| ACTION-03 | P1 | Edit money action | Press money advice | Scrolls to Quick Edit/Money, not full Wizard |
| ACTION-04 | P1 | Review rate action | Press currency advice | Scrolls to currency/rate control |
| ACTION-05 | P2 | Full Wizard still reachable | Use explicit full-plan edit | Wizard opens intentionally; normal edits remain page-based |
| ACTION-06 | P1 | No sticky card | Leave and reopen target page normally | Previously deep-linked card no longer forced open |
| ACTION-07 | P1 | Smart CTA vs Improve Plan | Press the contextual CTA, then press Improve Plan | Contextual CTA opens the targeted page/card; Improve Plan independently opens the full wizard |

## I. Persistence and cross-page consistency

| ID | Priority | Scenario | Steps | Expected |
|---|---:|---|---|---|
| DATA-01 | P0 | Hard reload | Build plan, refresh browser | Trip, money, costs and paid state remain |
| DATA-02 | P0 | Cross-page totals | Compare Dashboard, Trip Costs, Trip Payments, Review | Same canonical totals and currencies |
| DATA-03 | P1 | Delete and reload | Delete cost/commitment then refresh | Item stays deleted; no zombie suggestion/payment |
| DATA-04 | P1 | Update and reload | Edit amount/date then refresh | Latest value persists once; no duplicate row |
| DATA-05 | P0 | Backend unavailable | Stop backend while on saved trip | Clear unavailable/sync state; no silent destructive fallback save |

## J. Responsive UX and accessibility smoke

| ID | Priority | Scenario | Steps | Expected |
|---|---:|---|---|---|
| UX-01 | P1 | Desktop navigation | Test common desktop widths | Horizontal nav remains usable; no critical item hidden |
| UX-02 | P1 | Mobile width | Test 375–430 px | No horizontal page overflow; actions remain reachable |
| UX-03 | P2 | Keyboard | Tab through form/actions | Visible focus and logical order |
| UX-04 | P2 | Empty states | New user/no costs/no payments | Helpful next action, no broken blank screen |
| UX-05 | P2 | Loading/error states | Slow/block request | Clear loading/retry language; no raw technical stack shown |

## K. External country metadata foundation

| ID | Priority | Scenario | Steps | Expected |
|---|---:|---|---|---|
| EXT-01 | P1 | Country snapshot bootstrap | Start backend with an empty snapshot table, call GET `/api/external/countries` | Provider data is persisted; if provider is unavailable, bundled fallback is returned with `stale: true` |
| EXT-02 | P1 | Snapshot reuse | Call countries endpoint again before TTL expires | Fresh persistent snapshot is returned without requiring another provider fetch |
| EXT-03 | P1 | Stale fallback | Expire/block provider after a successful sync | Last-known-good snapshot remains available and is marked stale |
| EXT-04 | P1 | Admin-only force sync | Call POST `/api/external/countries/sync` as user then admin | Normal user is denied; admin can refresh and sees source/freshness status |
| EXT-05 | P2 | Country by code | Call GET `/api/external/countries/AE` | UAE metadata resolves from the same snapshot/fallback source |

---

## Final golden-path test

Perform this without shortcuts:

1. Register a new user.
2. Create a 10-day trip from UAE to another currency country.
3. Use AED as income currency and destination currency as trip currency.
4. Add savings, salary, support and safety reserve.
5. Add one monthly bill and a 3-part installment.
6. Add flight, daily food, monthly accommodation and Emergency from suggestions.
7. Confirm Dashboard totals and two-currency display.
8. Mark exactly one installment and one trip cost paid.
9. Switch display among trip currency, AED, USD and EUR.
10. Confirm paid state never resets and stored cost values do not mutate.
11. Edit dates and money via Quick Edit.
12. Use every visible coach action once.
13. Hard refresh and log out/in.
14. Compare Dashboard, Trip Costs, Trip Payments and Review.
15. Delete one cost and undo one paid occurrence; refresh again.

**Pass:** all pages agree, no duplicates, no lost paid marks, correct currency conversions, clear verdict and next action.

## K. v4.29.40 FX snapshot and Available Money hierarchy

| ID | Priority | Scenario | Steps | Expected |
|---|---:|---|---|---|
| FX-08 | P1 | Fresh persistent snapshot | Fetch a rate twice within TTL | Second request uses snapshot; provider is not forced |
| FX-09 | P0 | Manual override protection | Enter a manual rate, wait/reopen wizard | Automatic refresh does not overwrite the manual rate |
| FX-10 | P1 | Last-known-good | Fetch once successfully, then block provider and request again | Saved rate returns with `stale: true`, source and confidence |
| FX-11 | P1 | Admin force sync | Admin selects base and presses Force sync | Snapshot refresh result and source metadata appear |
| UX-06 | P1 | Available Money hierarchy | Open wizard Step 2 | Savings/support are first; reserve is compact; currency details are collapsed unless review is required |
| UX-07 | P2 | Wizard help density | Open Money In section | Long guidance is behind “What counts here?”; presets/actions remain clear |
