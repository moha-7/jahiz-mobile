# v4.29.42 Recommendation Engine QA

## P0

- [ ] Unconfirmed rate shows only `Review rate`; no cost-range advice appears.
- [ ] No trip costs shows only `Edit costs`; no false saving/emergency advice appears.
- [ ] Saved and draft versions of the same trip show the same top reason code.
- [ ] Recommendation action opens the exact page/card and `Improve Plan` still opens the full Wizard.

## P1

- [ ] Saving gap is ranked before payment tracking.
- [ ] Missing/low Emergency recommendation disappears after the amount is corrected.
- [ ] Only one range adjustment appears at once.
- [ ] A required Flight/Accommodation amount below the Low range is flagged.
- [ ] Flexible category above Typical is suggested for reduction when a gap exists.
- [ ] Continuing installments link to Trip Payments.
- [ ] Ready plan recommends payment tracking/maintenance, not contradictory budget changes.

## Contract

- [ ] Every recommendation has `reasonCode`, `priority`, `confidence`, `source`, `target`, and action text.
- [ ] Maximum three visible recommendations.
- [ ] Impact amount uses Trip Currency.
- [ ] Backend endpoint rejects foreign trip ownership.
