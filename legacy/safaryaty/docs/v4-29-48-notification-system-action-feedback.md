# Safaryaty v4.29.48 — Notification System & Action Feedback

## Goal

Replace scattered string toasts and manual timers with one predictable notification system that supports short user-facing feedback without exposing backend or provider implementation details.

## Notification types

```txt
Success
Info
Warning
Error
Undo
```

Each type owns its default duration and icon. Error messages stay longer. Undo messages include an action and remain visible long enough to use it.

## Architecture

```txt
src/notifications.js
src/useNotificationCenter.js
NotificationHost in src/main.jsx
```

`notifications.js` is framework-independent and owns:

- normalization;
- compact title/detail limits;
- type defaults;
- deduplication keys;
- bounded queues;
- icon selection.

`useNotificationCenter.js` owns:

- the current notification queue;
- timed dismissal;
- manual dismissal;
- duplicate suppression;
- cleanup of active timers.

## UX rules implemented

- Only one notification is displayed at a time.
- Repeated identical messages are collapsed instead of stacked.
- Deep-link navigation is silent because the destination scroll/focus/highlight already explains the result.
- Display-rate and trip-currency loading states stay inside their affected controls instead of using global loading toasts.
- Normal users never see terms such as backend sync, finance snapshot, PaymentMark, rateBook or FX service.
- Errors provide a clear next action when retry is possible.
- Mark Paid exposes an immediate Undo action.
- Visually obvious additions are silent; the highlighted new card is the success feedback.

## Accessibility

- `role="alert"` and assertive live regions are used for errors.
- Other feedback uses a polite status live region.
- Action and close buttons have visible keyboard focus.
- The component remains usable on mobile widths.

## Out of scope

- No finance formula changes.
- No TripCost/Suggestion changes.
- No backend or Prisma schema changes.
- No database migration.

The next planned core phase is database normalization before PostgreSQL migration.
