# Safaryaty v4.27.1 — Currency Stability Patch

## Scope

Focused fix for currency UX and automatic exchange-rate refresh.

## Changes

- Auto rate now runs when the currency pair changes.
- Manual rate remains available as override.
- Smart Controls uses the same rate control as the Wizard.
- KPI cards show the selected display currency as primary.
- KPI cards also show a small converted value in the other currency when currencies differ.
- Reserve amount shows trip-currency equivalent under the input.
- Reduced mixed-currency confusion across key cards.

## Product rule

- Inputs keep their natural currency.
- Decision numbers use `Show Results In`.
- Secondary currency appears as a small equivalent, not as a competing primary number.
