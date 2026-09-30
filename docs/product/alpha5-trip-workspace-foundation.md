# Jahiz alpha.5 — Trip Workspace Foundation

## Goal

Replace the temporary multi-screen wizard mindset with one durable trip workspace that the user can resume and improve at any time.

```text
Trip Workspace
├── Route
├── Dates
├── Funds
├── Cost Items
├── Payments
└── Derived Steps and Summary
```

## Scope of this foundation

- Shared Zod contracts for the complete local workspace.
- Normalized cost categories.
- Cost-item and payment invariants.
- Persisted Zustand workspace store.
- Pure derived selectors for steps, progress and money totals.
- Contract tests.
- No screen redesign and no backend persistence in this milestone.

## Source of truth

The workspace stores user-entered facts only.

The following values are derived and must never be persisted as independent truth:

- Total trip cost.
- Paid total.
- Remaining total.
- Ready money.
- Need to save.
- Step completion.
- Plan progress.
- Next payment.

## Quick Add defaults

A quick cost entry requires:

- Title.
- Amount.
- Category.

The mobile store supplies:

- Workspace currency.
- `estimated` status.
- No due date.
- No notes.
- Zero payments until a payment is recorded.

## Migration boundary

The current route draft remains untouched in this milestone. The next vertical slice will migrate route writes into the trip workspace and then remove duplicate route state after behavior parity is proven.

## Finance boundary

`@jahiz/core-finance` remains frozen under parity protection. This foundation does not modify its copied Safaryaty files. Engine integration will happen through adapters and behavior tests in a later milestone.

## Route workspace integration

The route screen now uses local component draft state while editing and writes the validated result directly to the persisted trip workspace.

```text
Airport selection UI draft
→ shared route validation
→ Trip Workspace setRoute
→ persisted route
→ derived Plan step progress
```

The former global `route-store.ts` was removed. This prevents route truth from being duplicated between a temporary Zustand draft and the durable workspace.

Behavior rules:

- Opening Route restores the saved workspace route.
- Back discards unsaved edits.
- Continue validates, saves and returns to Plan.
- Save and exit saves only a valid complete route.
- Clearing the route changes only the route field; future dates, costs and payments remain available for review instead of being silently deleted.

## Dates vertical slice

Dates are edited as an independent resumable step, not as a locked wizard page.

```text
Saved workspace dates
→ local date editing
→ shared Zod date validation
→ Trip Workspace setDates
→ derived Plan progress
```

Behavior rules:

- Route Continue opens Dates to keep first-time setup efficient.
- Save and exit always returns to Plan.
- Back discards unsaved edits.
- Dates use explicit `YYYY-MM-DD` input for predictable cross-platform behavior.
- Return date cannot be before departure date.
- The user can mark dates as fixed or flexible.
- Trip duration is derived and never stored separately.
- Clearing dates does not delete route, funds, costs or payments.

## Funds vertical slice

Funds are separated into money available now, money expected before travel, protected reserve and origin commitments.

```text
Saved workspace funds
→ local money editing
→ shared Zod funds validation
→ Trip Workspace setFunds
→ derived Ready Money
→ derived Plan progress
```

Behavior rules:

- `availableNow` is required and may explicitly be zero.
- Empty optional fields become zero.
- Localized Arabic and Persian digits are normalized before validation.
- Values are stored with a maximum of two decimal places.
- Expected money is not presented as money available today.
- Ready Money is derived after reserve and origin commitments.
- Back discards unsaved edits.
- Clear Funds resets only funds and leaves route, dates, costs and payments intact.

## Cost categories and Quick Add vertical slice

Costs are managed through a hybrid model: Quick Add for speed and categories for organization.

```text
Quick Add
→ title + amount + category
→ estimated Cost Item
→ Trip Workspace addCostItem
→ category summary
→ total trip cost
→ derived Plan progress
```

Behavior rules:

- Quick Add requires only title, positive amount and category.
- Currency is inherited from the Trip Workspace.
- New Quick Add items default to `estimated`.
- Categories can contain multiple cost items.
- The general Quick Add requires an explicit category.
- Opening Quick Add from a category preselects that category.
- Removing a cost also removes any payments linked to it through the workspace store.
- One cost item completes the Costs setup step, while additional items improve plan accuracy.
- Payments and detailed confirmed-cost editing remain separate later slices.

## Premium shell and intelligent Plan

The approved dark glass mockups are the visual source of truth.

This slice introduces:

- a stable custom bottom tab bar with localized labels and true RTL visual ordering;
- a dark premium Plan screen with one route hero and compact clickable step cards;
- removal of large destructive actions from the Plan surface;
- a derived next-step card;
- smart Quick Add where choosing a cost category fills an editable default name;
- a dark readable cost summary.

The Trip Workspace, route, dates, funds, cost items, payments contracts and frozen core-finance package remain unchanged.

Structured commitments, installment schedules, linked payment management and the live Today dashboard remain the next domain and presentation slices.## Shell stabilization and appearance contract

The bottom tab bar expands at the top of a screen and compacts progressively while scrolling. It expands again as the scroll offset returns toward the top.

The tab bar remains part of the navigation layout. Scroll screens therefore use a small content bottom inset instead of reserving a second tab-sized footer area.

Appearance is controlled only from Profile settings:

- System default follows the phone appearance and is the initial preference.
- Light forces the light appearance.
- Dark forces the dark appearance.

The preference is persisted locally. This slice also removes the body-sheet highlight artifact and compacts the Plan route and step cards. Full semantic theme parity for every create-trip flow remains the next presentation slice before commitments and installments.

## Sprint 1.2A — Floating shell, live Today, and calendar dates

This stabilization slice uses the uploaded full repository as the source of truth.

It introduces:

- a transparent floating bottom tab frame whose active pill remains visible while page content scrolls behind the surrounding frame;
- scroll-driven expanded and compact tab states without an opaque footer block;
- removal of artificial body minimum heights that produced large blank areas at the end of tab screens;
- theme-aware shell, glass panels, app bars, icon buttons, Plan, Profile, and Today surfaces;
- a live Today screen derived from the persisted Trip Workspace instead of hard-coded Bahrain/BHD demo values;
- a dependency-free calendar picker for departure and return dates;
- automatic seven-day return-date suggestion after choosing departure;
- semantic light and dark contrast for text, surfaces, borders, and inputs.

This slice does not change Trip Workspace contracts, core-finance files, payments rules, or backend behavior.

After runtime verification, the current feature branch should receive the alpha.5 Git checkpoint before commitments and installment schedules are added.
