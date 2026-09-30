# Safaryaty v4.29.47 — Compact Layout & Currency Deep Links

## Scope

UI/UX correction over v4.29.46. Finance truth, TripCost identity, suggestion persistence, payment progress, APIs and Prisma schema remain unchanged.

## Root cause fixed

The previous global equal-height rules applied `grid-auto-rows: 1fr` to editable content grids. Because the currency notice, suggestion builder and Smart Cards were siblings, a short notice inherited the height of a very large suggestion panel. The same rule stretched Salary, Food and other collapsed cards into mostly empty panels.

Editable grids now use natural content height. Equal-height behavior remains only for genuinely comparable KPI and summary families.

## Trip Costs layout

- Trip currency notice is compact and full-width.
- Destination Budget Builder is full-width and starts on its own row.
- Selected and available suggestion columns use natural height.
- Collapsed Smart Cards no longer inherit the tallest row height.
- Expanded cards grow only by their actual content.

## Currency deep link

Both the Trip Costs currency notice and the Suggestions header provide a direct Currency Setup action.

The action:

1. opens Improve Plan;
2. navigates to Available Money;
3. opens Currency Setup;
4. scrolls and focuses the control;
5. highlights it briefly;
6. collapses it after a successful currency/rate change.

Opening Improve Plan normally resets the deep-link request and starts the regular Wizard flow.

## Modal policy

- Wizard modal: large bounded shell (`1180 × 780` maximum).
- New Trip/standard modal: compact bounded shell (`940px` maximum width, content-driven height).
- Authentication gate uses the compact family.
- Mobile modals use the full viewport.
- Long content scrolls inside the modal body.

## Acceptance criteria

- No large empty currency notice on Trip Costs.
- No collapsed Salary/Food/TripCost card stretches to page height.
- Wizard Step 4 remains compact.
- Currency deep link reaches the single canonical editor.
- Currency setup closes after a successful deep-linked change.
- Normal Improve Plan does not unexpectedly reopen the previous currency deep link.
