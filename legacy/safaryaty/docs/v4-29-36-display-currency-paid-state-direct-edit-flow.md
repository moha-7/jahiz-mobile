# v4.29.36 — Display Currency Paid State + Direct Edit Flow

## Fixes

1. Display currency changes now update trip metadata only.
   They no longer trigger full finance snapshot sync, because finance sync deletes/recreates finance rows and can invalidate PaymentMark keys.

2. Paid payment state should remain after switching display currency.
   Display currency is a view preference, not a finance mutation.

3. Overview now includes direct edit controls for:
   - start date
   - return date
   - savings
   - support money
   - safety reserve
   - Need to Save preview

4. Coach actions no longer route money/rate fixes to the wizard by default.
   They scroll to the relevant overview edit card or display currency card.

5. Display currency selector now offers:
   - trip currency
   - income currency
   - USD global benchmark
   - EUR global benchmark
   - extra supported currencies

## Manual QA

- Mark a payment paid, then change Display Currency to USD/AED/EUR. Paid Already and the paid row must remain.
- Change Start/Return date from Overview and confirm payments recalculate.
- Change Savings/Support from Overview and confirm Need to Save changes.
- Press Review rate / Open money from the coach action and confirm it scrolls to the relevant page section, not the wizard.
- Change Display Currency only and confirm trip costs are not duplicated and finance rows are not recreated.
