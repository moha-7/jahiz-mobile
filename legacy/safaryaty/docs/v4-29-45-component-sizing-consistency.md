# v4.29.45 — Component Sizing Consistency

## Scope

UI consistency only. Finance, currency, PaymentMark, score, verdict, APIs, and Prisma schema are unchanged.

## Rules

- Cards in the same grid stretch to the same height.
- Each component family has a consistent minimum height and radius.
- Buttons, inputs, selects, and close controls use one control-height token.
- Wizard, New Trip, and authentication gate use the same desktop modal shell dimensions.
- Desktop modal header/body sizing is fixed and predictable.
- Mobile modal shells use the full viewport.
- Content remains scrollable rather than enlarging one modal beyond another.

## Component families covered

- Dashboard KPIs
- Decision/client cards
- Smart item cards
- Recommendation cards
- Money Intelligence cards
- Payment groups
- Suggestion/selected-cost cards
- Purpose cards
- Coach cards
- Standard modal shell
- Authentication gate shell

## Manual QA

Test at 1440, 1280, 1024, 768, 430, and 375 px widths.

1. Compare cards in every grid. Cards in the same row must have equal height.
2. Open Improve Plan, New Trip, and the authentication gate. Desktop shells must share the same outer size.
3. Confirm long content scrolls inside the modal instead of increasing the modal size.
4. Confirm controls align vertically and share the same height.
5. Confirm mobile modals fill the screen and do not overflow horizontally.
