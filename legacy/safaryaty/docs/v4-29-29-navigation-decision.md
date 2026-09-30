# Safaryaty v4.29.29 — Navigation Decision

## Decision

Keep the main user navigation horizontal for the current MVP dashboard.

## Why horizontal works now

- The user has only a small number of primary destinations.
- It keeps the travel dashboard visually light.
- It supports the current decision-first product flow: Dashboard → Trip Payments → Trip Costs → Commitments → Recommendations.
- It avoids turning the product into an admin dashboard too early.

## When vertical becomes better

Use a vertical sidebar later for:

- Admin Console
- Advanced analytics
- Settings-heavy pages
- Full desktop financial planning mode
- Many nested tools or future API/ML modules

## Recommended hybrid model

### Current MVP

- Desktop: horizontal top nav.
- Mobile: compact bottom or horizontal scroll nav.
- Wizard: left stepper because it is a guided sequence.

### Later Pro/Admin product

- Normal user: horizontal / bottom nav.
- Admin and advanced mode: optional vertical sidebar.

## UI rules

- Keep labels short.
- Do not add more than 7 visible main nav items.
- Put technical tools under Advanced or Admin.
- Keep Dashboard first and Profile last.
