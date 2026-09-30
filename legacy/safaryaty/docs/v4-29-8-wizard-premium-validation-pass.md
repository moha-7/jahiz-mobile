# Safaryaty v4.29.8 — Wizard Premium UX + Validation Pass

## Purpose

Builds on v4.29.7 without reverting previous work.

## Included

### Date validation
- Wizard date fields now use native browser date picker controls.
- Internal date values remain `YYYY-MM-DD`.
- Compact invalid values like `20122001` are not saved unless they can be converted to a valid ISO date.
- End Date uses Start Date as minimum in the picker.
- Invalid dates are blocked from state updates and highlighted by wizard validation.

### Zero inputs
- Validation no longer treats `0` as empty for money inputs.
- Negative amounts are still invalid.
- This preserves `0` as a valid planning value while avoiding accidental falsey handling.

### Score/source of truth
- Support money and savings remain calculated inside `engine.js` / backend summary, not UI components.
- Added tests confirming support money increases available cash/readiness.
- Comfort level now affects score strictness inside the calculation engine.
- Backend summary scoring was aligned with the same comfort strictness model.

### Comfort level recommendations
- Suggestions now use comfort total multipliers:
  - Survival: lower suggested total
  - Balanced: normal
  - Comfortable: higher suggested total
  - Premium: strict/high suggested total

### Suggestions UX
- Destination suggestions were redesigned into premium interactive cards.
- Cards are collapsed/expandable.
- User can choose:
  - Use recommended
  - Custom amount
  - Skip
- Added/Adjusted/Skipped/Selected badges are shown.
- Existing user plan values show update warning before applying.
- Nothing is added until the user clicks the final Add selected button.

### Performance
- Auto rate no longer refetches when a valid confirmed pair already exists.
- Suggestion memo dependencies are narrower.
- Backend summary refresh uses the central summary application helper.

## Protected

Not changed:
- API contracts
- Prisma schema
- payment mark/undo contract
- route country-first behavior
- commitments A/B structure
- KPI labels

## Tests

Frontend:
- `npm run test:all` passed.
- `npm run build` passed.

Backend:
- Backend logic was patched, but sandbox backend install timed out during Prisma engines postinstall. Test backend locally using the Windows scripts.
