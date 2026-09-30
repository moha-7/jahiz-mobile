# Safaryaty v4.13 Testing Checklist

## Critical Logic Tests

1. Mark Paid
   - Add life cost/installment.
   - Open To Pay.
   - Click Mark Paid.
   - It must move to Paid and no longer count as upcoming.
   - Click Undo and it must return to Upcoming.

2. Draft Wizard Isolation
   - Open an existing saved trip.
   - Start a new trip wizard but do not finish.
   - Close the wizard.
   - The app must return to the original saved trip, not the unfinished draft.
   - Resume Draft must reopen the draft.
   - Finish must create the new trip only once.

3. User Data Isolation
   - Login as User A and create a trip.
   - Logout.
   - Login as User B.
   - User B must not see User A trips.

4. Currency Control
   - Change route country.
   - Trip currency is suggested automatically.
   - Manually change Income Currency / Trip Currency.
   - Exchange rate must request review when pair changes.

5. Profile
   - Upload photo.
   - Change preferred currency/language.
   - Save profile.
   - Logout/login in same browser session and confirm saved profile.

## Mobile Checks

- No horizontal scroll.
- Wizard buttons are tappable.
- Profile photo upload does not break layout.
- Tabs remain usable on small screens.

## Build Test

`npm run build` passed for v4.13.
