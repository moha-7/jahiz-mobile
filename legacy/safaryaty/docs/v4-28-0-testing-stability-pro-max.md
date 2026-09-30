# Safaryaty v4.28.0 — Testing & Stability Pro Max

## Purpose

This sprint intentionally adds **no product features**. It protects the core logic before we continue UI polish, Monthly Destination Logic, and Suggestions/API work.

## Protected core

Do not break:

- `src/engine.js`
- `src/payments.js`
- `src/canTravel.js`
- Trip Intent flow
- Dynamic Destination Costs
- Existing Commitments + Monthly Payments
- Installments / Monthly Payments
- To Pay schedule
- Mark Paid / Undo
- Demo → Register/Login → same trip
- Currency display / FX rate handling

## Added

### Scripts

- `npm run test:core`
- `npm run test:stability`
- `npm run test:all`
- `scripts/test-windows.ps1`
- `scripts/test-mac.sh`

### Smoke coverage

`test:stability` verifies:

1. Required files exist.
2. Study monthly costs multiply by months.
3. One paid monthly occurrence is counted once.
4. Installments remain in the To Pay schedule.
5. Paid rows appear in the paid schedule.
6. Can Travel returns a valid verdict.

## Manual Pro Max test matrix

### A. Short Trip

- Trip type: Short Trip
- Route: AED → EGP
- Duration: 5–10 days
- Add flight, stay, food, transport, emergency
- Change display currency
- Mark one payment paid
- Undo paid
- Expected: Need to Save / Paid / To Pay update correctly

### B. Study / Long Stay

- Trip type: Study Trip
- Route: AED → EUR
- Duration: 6 months
- Add university fees
- Add student rent/month
- Add food/month
- Add transport pass/month
- Add family support as Existing Commitment
- Expected: monthly destination costs multiply by months, installments stay visible

### C. Relocation

- Trip type: Relocation
- Add deposit, first rent, furniture, documents, first month living
- Expected: setup + monthly plan remains clear

### D. Auth flow

- Try demo first
- New Trip
- Finish
- Register/Login
- Expected: same trip opens immediately
- Logout
- Expected: auth page opens, not automatic demo

### E. Currency

- Change trip country/currency
- Verify auto rate
- Set Display Currency
- Expected: KPI primary currency is unified, equivalent appears smaller

### F. Mobile

- Wizard Next button reachable
- Bottom tabs not blocking actions
- Cards readable
- Payment tracker rows usable

## Rule for next sprint

If any test in this sprint fails, fix stability before adding:

- More suggestions
- External APIs
- Mobile redesign
- New dashboards
