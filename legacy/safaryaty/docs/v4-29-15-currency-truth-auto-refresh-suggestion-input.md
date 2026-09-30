# v4.29.15 — Currency Truth + Auto Refresh + Suggestion Input UX

## Currency truth

- Auto rate now applies through a single atomic `applyAutoRate` update, so it no longer gets overwritten as MANUAL by the normal exchangeRate field handler.
- Conversion rule is explicit: `amount_base * rate = amount_trip`.
- Manual rate remains supported and marks the source as MANUAL.
- Auto rate stores `rateMode`, `rateSource`, `rateUpdatedAt`, and `rateBook[pair]`.
- Frontend periodically refreshes AUTO rates every 30 minutes while planning.
- Backend FX cache TTL reduced from 6 hours to 1 hour.
- `/api/fx/rate` accepts optional `refresh=1` to bypass cache safely.
- Saved trips now preserve `rateMode` instead of always saving MANUAL.

## Suggestion input UX

- Replaced raw custom amount row with a compact mini amount editor.
- Editor includes amount stepper, currency suffix, recommended amount, -20%/-10%/+10%/+20%, use recommended, save and cancel.

## Protected

- No Prisma schema changes.
- No score formula changes.
- No payment logic changes.
- No suggestion generation formula changes in this patch.
