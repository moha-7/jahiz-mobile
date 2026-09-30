# Safaryaty v4.27.2 — Demo Migration + Wizard Purpose Foundation

## Goal

Keep the demo-first funnel, but make it professional:

1. User can create a trip as demo/guest.
2. User finishes the wizard and sees the result.
3. Account gate appears.
4. After register/login, the same demo trip is saved into the backend.
5. The app opens directly on that trip.

## Product update

Step 1 is now **Trip Setup**, not only Route:

- Trip Purpose cards
- Travel Style selector
- Auto trip length label
- Route
- Dates
- Travelers

This prepares Suggestions Engine without changing the backend roadmap.

## Technical note

Added `pendingGuestTrip` handling so the finished demo trip is prioritized during authentication migration. The default demo preview is not treated as the primary saved trip.
