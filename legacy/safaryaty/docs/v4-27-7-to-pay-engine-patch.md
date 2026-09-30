# Safaryaty v4.27.7 — To Pay Engine Patch

## Goal

Make To Pay a real payment schedule, not just a list of origin commitments.

## Added

- `src/payments.js`
- `src/payments.test.js`

## What changed

The payment schedule now includes:

- Money In rows
- Existing Commitments rows
- Installment / Monthly Payment rows
- Destination Cost rows
- Monthly destination cost occurrences
- Daily destination cost occurrences

## Key fix

A Study Trip with:

```txt
Student Accommodation / Month = 600 EUR
Trip length = 6 months
```

now creates:

```txt
Student Accommodation · Month 1
Student Accommodation · Month 2
...
Student Accommodation · Month 6
```

Marking one month paid only pays that one occurrence.

## Installments

Installments remain core and are shown as `Monthly Payment` rows in To Pay.

## UI behavior

- Payment Tracker now uses `calc.paymentSchedule` when backend payments are not available.
- Backend payments remain preferred for saved trips.
- Local payment schedule is the fallback for demo/guest mode.

## Tests

```txt
node --test src/engine.test.js src/payments.test.js
```

12/12 passing.

## Next sprint

v4.27.8 — Can Travel + Live Score

- Show one clear verdict.
- Add compact score inside wizard.
- Add next best action.
