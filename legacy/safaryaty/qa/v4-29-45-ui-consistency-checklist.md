# v4.29.45 — UI Consistency Checklist

Test at: 1440×900, 1280×800, 1024×768, 768×1024, 430×932, and 375×812.

## Cards

- Dashboard KPI cards in the same row have equal height.
- Decision factor cards have equal height.
- Recommendation cards have equal height.
- Money Intelligence cards have equal height.
- Trip-purpose cards have equal height.
- Payment groups align when shown side by side.
- Suggestion and selected-cost columns align without one container stretching unpredictably.
- Long content stays inside its card and does not overlap the next card.

## Modals

Open each of these:

- Improve Plan
- New Trip
- Authentication/save gate

Expected:

- Same desktop outer shell dimensions.
- Same border radius and close-button size.
- Header height is visually consistent.
- Long content scrolls inside the body.
- No double page/modal scrolling.
- At mobile widths, the modal fills the viewport.
- No horizontal overflow.

## Controls

- Primary/secondary buttons align in the same row.
- Inputs and selects share one height.
- Date-picker and close buttons align with other controls.
- Focus states remain visible with keyboard navigation.

## Regression

- Wizard navigation remains usable.
- Finish/Next/Back buttons remain visible.
- Trip Costs/Suggestions cards still expand and collapse.
- Payment Mark Paid/Undo remains unchanged.
- Finance KPIs remain unchanged.
