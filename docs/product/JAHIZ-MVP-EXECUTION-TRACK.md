# Jahiz MVP execution track

## Product goal

Deliver a coherent bilingual mobile product that lets a traveller:

1. create a route and dates;
2. enter usable money and reserves;
3. record structured commitments;
4. estimate trip costs quickly;
5. split costs into installments or scheduled payments;
6. see paid, remaining, overdue and next-payment totals;
7. receive a truthful readiness verdict and a clear next action;
8. retain the workspace after closing the app.

## Current milestone: alpha.5 candidate

Implemented:

- persisted Trip Workspace;
- route, dates, funds and cost items;
- smart category defaults;
- editable existing cost title, category and amount;
- live Today totals;
- Light, Dark and System themes;
- RTL-aware premium shell;
- floating dynamic tab navigation;
- calendar-based dates.

Runtime approval still required for:

- full flow theme parity;
- keyboard-safe Quick Add;
- correct floating-tab content inset;
- compact cost categories and editable cost rows;
- budget-coverage wording.

## Next product slices

### Slice A: structured commitments

Replace the single commitments amount with items containing:

- type;
- suggested editable title;
- amount;
- due date;
- include-in-readiness flag.

The current aggregate field remains available during migration.

### Slice B: installments and payments

Each cost can have:

- full payment;
- installments;
- pay later.

Each payment stores:

- linked cost;
- amount;
- status;
- due date;
- paid date;
- optional method and notes.

Derived totals are never stored separately.

### Slice C: Payments product screen

Provide:

- all, due and paid filters;
- next payment;
- overdue state;
- paid and remaining totals;
- payment creation and update;
- cost-level progress.

### Slice D: final readiness

Combine:

- setup completion;
- budget coverage;
- commitments due before travel;
- payment schedule;
- overdue attention;
- safety reserve.

The product must distinguish budget coverage from final trip readiness.

### Slice E: release hardening

Before beta:

- scoped Git commit and tag;
- Arabic and English smoke tests;
- Light and Dark screenshot checks;
- persistence migration test;
- empty and reset states;
- accessibility labels;
- offline launch;
- production error boundary;
- privacy and data screen;
- release build verification.

## Sprint 2A - Structured Commitments Domain

- Added structured commitment categories and items.
- Added paid and unpaid commitment state.
- Added due date and due-before-travel fields.
- Added a review checkpoint so setup progress cannot reach 100% before commitments are reviewed.
- Added automatic migration from the previous combined Home commitments amount.
- Ready Money now deducts unpaid commitments due before travel.
- Added next-commitment and commitment-total selectors.
- UI delivery follows in Sprint 2B without changing this contract.

## Sprint 2B - Structured Commitments UI

- Added a bilingual Light and Dark commitments screen.
- Added category-based smart titles, editable name and amount, paid state, due date calendar and due-before-travel state.
- Added add, edit and delete flows.
- Added Funds, Plan and setup-progress integration.
- Funds now continues to Commitments before Costs.
- Ready Money and Today continue to use the structured commitment selectors.
- Legacy combined commitments are shown as an editable item for review.

## Sprint 3A - Structured Money In Domain

- Added structured Money In categories for savings, salary, freelance or business income, family support, bonus or commission, refunds, asset sales and other sources.
- Added availability, before- or after-travel timing, optional expected date, certainty and include-in-readiness controls.
- Added Money In review state and add, update, remove and review store actions.
- Added derived totals for available now, expected before travel, expected after travel, guaranteed, non-guaranteed and usable trip money.
- Ready Money now consumes usable structured Money In before reserve and commitment deductions.
- Added compatibility migration from the current aggregate funds fields without double counting.
- Kept the current Money screen working as a transitional aggregate editor until Sprint 3B delivers the structured UI.
- Added six Money In contract tests, bringing Trip Workspace tests from 16 to 22.
