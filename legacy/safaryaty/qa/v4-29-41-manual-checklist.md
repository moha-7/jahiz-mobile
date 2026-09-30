# v4.29.41 Manual QA

## Dashboard

- [ ] Money snapshot shows Ready Money, Trip Plan Cost, Paid So Far, Still To Pay.
- [ ] Paid So Far rises after Mark Paid.
- [ ] Still To Pay drops by the same amount.
- [ ] Funding status shows either Need to Save or expected after-trip money.
- [ ] Dashboard no longer repeats Top Advice and duplicate number cards.
- [ ] Quick Edit is collapsed by default and opens normally.

## Actions

- [ ] Primary smart CTA opens the exact page/card.
- [ ] Improve Plan opens the full Wizard.
- [ ] The two buttons are visually and verbally distinguishable.
- [ ] The right-side Action Guide does not duplicate the buttons.

## Trip Costs currency

- [ ] Wizard → Trip Costs shows the currency selector.
- [ ] Any supported currency can be selected.
- [ ] Use Destination Currency restores the destination default.
- [ ] Changing currency requests rate confirmation.
- [ ] Confirming the rate converts existing trip costs once.
- [ ] Changing cost currency does not reset paid payments.

## Cost ranges

- [ ] Low < Typical < High for every core category.
- [ ] Range currency matches the selected Trip Cost currency.
- [ ] Backend range is used when available; local fallback still renders when backend is offline.
- [ ] Confidence and source are visible.
- [ ] Salary, savings, support, and Ready Money do not change range estimates.
- [ ] Changing days, travelers, comfort, or destination updates the range.
- [ ] Selected cost displays Below / Inside / Above range correctly.
