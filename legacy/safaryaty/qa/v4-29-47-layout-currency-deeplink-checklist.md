# v4.29.47 Manual QA

## Desktop layout

Test at 1440×900, 1280×800 and 1024×768.

- Trip currency notice is one compact row.
- Budget Builder starts below it at full width.
- Collapsed cost and income cards use content height.
- No blank card taller than its content.
- Suggestion columns begin at the same top position but do not force equal total height.

## Wizard

- Open Improve Plan normally: regular Wizard flow opens.
- Go to Trip Costs: no oversized blank currency panel.
- Click Currency Setup from Trip Costs: Wizard navigates to Available Money.
- Currency Setup expands, scrolls into view and receives focus.
- Change a currency and wait for completion: Currency Setup collapses.
- Close and reopen Improve Plan normally: it must not jump back to Currency Setup.

## Suggestions

- Currency pill in Destination Budget Builder shows current Trip Currency.
- Clicking it opens the same canonical Currency Setup.
- Add Essentials, custom amount, remove/restore and card collapse continue working.

## Modal sizes

- Improve Plan uses the large bounded modal.
- New Trip and Auth use the compact family.
- No modal exceeds the viewport.
- On mobile, modals fill the viewport with internal scrolling.

## Regression

- Finance totals unchanged.
- Suggestions do not duplicate.
- PaymentMark state unchanged.
- Display Currency remains presentation-only.
