# Safaryaty v4.19 — Logic Audit Before Backend

## Fixed

- Removed recurring `Day of Month` input from income/life costs.
- Monthly income and monthly life costs now use `Start Date` and optional `Repeat Until`.
- `Repeat Until` defaults logically to trip return date if empty during calculation.
- Added stricter validation for amount fields:
  - income amount must be more than 0
  - life cost amount must be more than 0 if enabled
  - installment amount must be more than 0
  - trip cost amount must be more than 0
- Errors are field-level and live-clear when corrected.
- One-time items require exact date.
- Recurring items require start date.
- Installments use next due date/start date, not a random monthly day field.
- Default new income/life/installment start date is today, not trip date.
- User data namespace updated to v4.19 to reduce old localStorage conflicts.

## Core Logic Rule

Recurring items represent planning from a real start date:

```text
Monthly Salary: starts on date X and repeats monthly until return date or repeat-until date.
Rent: starts on date X and repeats monthly until return date or repeat-until date.
```

One-time items represent one payment on one date.

## Backend Next

Backend should preserve this model:

- `frequency`: monthly / weekly / daily / yearly / one-time / trip-total
- `startDate`/`nextDate`: required for recurring
- `untilDate`: optional, defaults to trip return date for trip calculations
- `expectedDate`: required for one-time
- amount validation enforced on API too
