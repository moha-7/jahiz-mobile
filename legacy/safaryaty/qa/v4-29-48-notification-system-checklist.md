# v4.29.48 — Notification System QA

## Payment actions

1. Mark one payment paid.
2. Confirm one Undo notification appears.
3. Click Undo.
4. Confirm the payment returns to Upcoming and the old notification closes.
5. Rapidly click the same failed/repeated action where possible.

Expected:

- duplicate messages do not stack;
- the current notification shows a repeat count when applicable;
- PaymentMark behavior and finance KPIs remain unchanged.

## Deep links

Open:

- a recommendation deep link;
- Currency Setup from Trip Costs;
- an exact TripCost category action.

Expected:

- no redundant “opened” toast;
- the target scrolls into view, opens and highlights correctly.

## Loading behavior

Test display-currency and trip-currency changes.

Expected:

- loading appears in the affected control/button;
- no global loading toast;
- success may be silent when the changed value is already visible;
- failure shows one short error with a usable retry path.

## Message quality

Trigger success, info, warning and error examples.

Expected:

- one short title;
- at most one short detail;
- no backend sync, provider, PaymentMark, rateBook or finance-snapshot wording;
- warning/error colors are visually distinct without relying on color alone.

## Accessibility

- Tab to notification action and dismiss controls.
- Confirm visible focus.
- Confirm errors are announced as alerts.
- Confirm other messages use polite status announcements.
- Test at 375px and 430px widths for overflow.

## Regression

Re-run:

- Mark Paid / Undo / reload;
- Trip Costs/Suggestions apply/remove;
- Currency deep links;
- Wizard finish validation;
- Draft save/delete;
- Trip archive/restore/delete.
