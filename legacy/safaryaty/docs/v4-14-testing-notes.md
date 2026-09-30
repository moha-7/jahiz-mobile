# Safaryaty v4.14 Testing Notes

## Tested by build

- `npm run build` completed successfully.

## Logic fixes included

### Income
- Salary added to Money In quick add.
- Income items keep their own cash-in date.
- Finish validation blocks enabled income with missing amount or missing date.

### Dates
- Finish validation blocks missing departure date.
- Finish validation blocks missing return date.
- Finish validation blocks return date before departure date.

### Currency
- Wizard now includes clear currency quick options.
- Auto option uses route currencies.
- Manual currency selection remains available.
- Exchange rate validation blocks Finish when base/trip currencies differ and rate is missing.

### Paid KPI
- Paid KPI now uses both:
  - trip budget items marked paid
  - payment tracker rows marked paid
- Still Needed now includes unpaid trip costs and unpaid generated payments.

### Profile
- Uploaded profile image appears in the header user card.
- Profile tab still controls avatar, preferences, language, and password placeholder.

## Manual regression checklist

1. Create user A, upload avatar, confirm avatar appears in header.
2. Start wizard, add Salary from quick add, set amount and date.
3. Try Finish without dates: should block.
4. Set return date before start date: should block.
5. Set valid route/dates/rate: Finish should create trip.
6. Mark a payment paid: Paid KPI should update.
7. Undo paid: Paid KPI should decrease.
8. Start a new draft, close wizard, confirm old trip remains active.
9. Resume draft, Finish, confirm only then new trip is saved.
10. Switch currencies manually in wizard and confirm rate review appears if needed.
