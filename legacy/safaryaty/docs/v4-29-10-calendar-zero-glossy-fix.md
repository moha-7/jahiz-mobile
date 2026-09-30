# v4.29.10 — Calendar, Zero Input & Glossy Wizard Tabs Fix

## Fixed

- Calendar button now opens a real native date picker through `showPicker()` when supported.
- Date display inside the wizard uses `YYYY-MM-DD` instead of browser locale display.
- Old/past invalid trip dates are blanked by min validation instead of being treated as valid travel dates.
- End date cannot be before start date.
- Number inputs use text + numeric keyboard mode, so `0` is accepted and no browser spinner behavior interferes.
- Reserve amount now uses nullish fallback instead of `||`, preserving explicit zero.
- Wizard side steps now have a clear glossy/Instagram-like active state.
- Quick-add chips and A/B commitment switch received clearer glossy treatment.

## Not changed

- engine.js
- payments.js
- canTravel.js
- backend contracts
- Prisma schema
- payment source of truth
- suggestion engine contracts
