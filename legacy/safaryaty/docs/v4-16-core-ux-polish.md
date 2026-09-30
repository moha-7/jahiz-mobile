# Safaryaty v4.16 — Core UX Polish Before Backend

## Main fixes

- Wizard validation is now soft while moving between steps.
- Next is never blocked by validation.
- Full validation runs only on **Finish & Create Trip**.
- Finish errors appear as a list inside the wizard, not only as a toast.
- Signup/profile photo is uploaded normally from the device using file input.
- Paid amount card is visible in the client cards and updates after Mark Paid / Undo.
- Auth/session keys moved to v4.16 namespace to avoid older local data conflicts.

## Validation behavior

The app now follows common wizard UX:

1. User can move forward/backward freely.
2. Missing required data appears as soft warnings.
3. The trip is created only after final validation passes.
4. The app does not create or save an unfinished trip.

## Tested

- `npm run build` passed.
- Signup upload field compiles.
- Wizard warnings do not disable Next.
- Finish validation blocks only final creation.
