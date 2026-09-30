# Safaryaty v4.28.5 — Wizard Scroll Top Fix

## Goal

Each wizard step should open from the top, not from the scroll position left by the previous step.

## Change

- Added a `wizardMainRef` inside the Wizard component.
- On every step change, Safaryaty scrolls:
  - the wizard main area
  - the modal body
  - the modal box fallback

## Scope

UI/UX fix only.

No changes to:

- engine.js
- payments.js
- canTravel.js
- backend
- calculations
- installments
- currency logic
