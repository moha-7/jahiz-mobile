# v4.15 Currency Dropdown Fix

## Change

Currency selection inside the wizard was changed from many visible currency buttons to a cleaner dropdown-based selector.

## New Behavior

- Shows one card: Currency Options.
- Has an Auto from route button.
- Has two dropdowns:
  - Income Currency
  - Trip Currency
- The duplicated currency dropdowns below were removed.
- Manual rate still appears only as the next required field.

## Reason

The previous button/chip layout was too visually noisy, especially on mobile. The new dropdown structure is clearer and more scalable when more countries/currencies are added.

## Build Test

`npm run build` passed successfully.
