# v4.29.22 — Currency Change Conversion QA

## Bug fixed

When Trip Currency changes, trip-local amounts must be converted to the equivalent value in the new trip currency instead of keeping the same raw number.

## Rule

`newTripAmount = oldTripAmount / oldRate * newRate`

Where:
- oldRate = `1 baseCurrency = oldTripCurrency`
- newRate = `1 baseCurrency = newTripCurrency`

## Convert when Trip Currency changes

- `budget[].amountLocal`
- `supportLocal`
- selected suggestion amounts because they are stored as trip costs
- emergency amount because it is a trip cost/support style local amount

## Do not convert

- `startingSavingsBase`
- `incomeSources[].amountBase`
- `lifeCosts[].amountBase`
- `installments[].monthlyBase`
- `scenario.reserveAmountBase`

## Manual QA scenario

1. Set Income Currency = AED.
2. Set Trip Currency = EGP.
3. Use rate 14.1108.
4. Add trip costs/suggestions totaling 45,000 EGP.
5. Change Trip Currency to EUR.
6. Let auto rate update or enter manual EUR rate.

Expected:
- Trip costs become approximately `45000 / 14.1108 * EUR_RATE`, not `45,000 EUR`.
- Review, KPIs, Payments, and Suggestions basket use the converted amounts.
- Salary/savings/income amounts in AED stay unchanged.
