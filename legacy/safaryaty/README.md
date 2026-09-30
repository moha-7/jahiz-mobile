# Safaryaty v4.27.1 — Currency + Auth Flow Stability

This release focuses on stability and clarity before more product features.

## Fixes

- Logout now opens the Sign in / Create account screen instead of silently returning to demo mode.
- Demo is still available through a clear "Try demo first" button.
- Exchange rate now auto-refreshes when the income/trip currency pair changes.
- Manual rate is still available as an override.
- KPI cards show the selected display currency and a small equivalent value in the other currency.
- Smart Controls use the same automatic rate control.
- Current Savings / Support Money show secondary currency hints.
- Event Management remains an internal calculation process, not a separate tab.

## Flow

Open app → demo by default for new visitors → build trip → save account when ready.

After logout → login page → user can sign in or choose demo manually.

## v4.27.2

- Demo trip now migrates into a real backend trip after Register/Login.
- After auth, the saved demo trip opens immediately.
- Wizard Step 1 now starts with Trip Purpose + Travel Style + route details.

## v4.27.4

Intent-first flow is now the default product direction. Long onboarding is removed from the empty state, Google OAuth foundation is added, and demo trip migration is protected before external OAuth redirect.

## v4.27.5 — Dynamic Wizard Categories

- Trip Purpose stays outside the wizard.
- Existing Commitments are separated from Destination Costs.
- Destination Costs quick-add cards now change by trip type.
- Cost metadata is introduced: costType and currencyScope.
- This prepares Study / Long Stay / Relocation / Event logic without breaking current calculations.

## v4.27.6 — Engine Stability Patch

- Integrated `src/engine.js` from the handoff bundle as the frontend calculation engine.
- Monthly destination costs now multiply by trip months.
- Daily costs now multiply by trip days.
- Readiness is the single score; old extra score logic now mirrors readiness.
- Installments remain core.
- Added backend readiness/scoreFactors foundation and monthly TripCost total handling.

## v4.27.7 — To Pay Engine Patch

- Added a pure payment schedule engine.
- To Pay now includes destination costs, monthly destination costs, existing commitments, and installments.
- Monthly destination costs generate month-by-month payment rows.
- Mark Paid / Undo works on individual occurrences in local/demo mode.

## v4.27.8 — Can Travel + Live Score

- Added canTravel verdict engine.
- Wizard now shows live score while the user edits the plan.
- Overview now answers the core product question: Can you travel?
- Review screen shows verdict and next best action.
- Core tests include engine, payments, and canTravel.

## v4.27.9 — Commitments UI Simplification

- Combined Life Costs + Installments visually under Existing Commitments.
- Data remains separate internally: `lifeCosts` and `installments`.
- Installments are now called Monthly Payments in the UI.
- Added installment presets.
- Hid technical `costType` and `currencyScope` fields from the normal user flow.
- Core engines were not changed.

## v4.28.0 — Testing & Stability Pro Max

This version adds stability scripts and QA docs without changing the product core.

Run frontend stability checks:

```bash
npm run test:core
npm run test:stability
npm run build
```

Windows full check:

```powershell
.\scripts\test-windows.ps1
```

Mac/Linux full check:

```bash
./scripts/test-mac.sh
```

## v4.28.1 — Simple Mode UI Foundation

UI/UX-only refinement. The app now presents Home, Payments, Trip Costs, Advice, My Trips, and Travel Profile with simple language. Advanced technical details remain available only in Advanced Mode. Core engines and backend logic are unchanged.

## v4.28.2 — Web UI Polish Foundation

- Web UI polish only.
- Home is decision-first.
- KPIs moved into Home instead of appearing globally on every tab.
- Added desktop Travel Coach panel.
- Kept all core engines and tests untouched.

## v4.28.4 — Language & Progress Polish

- Added global EN/AR/ES language switcher.
- Added RTL handling for Arabic.
- Navigation labels and Simple/Advanced switch react to selected language.
- Added readiness progress bar on Home.
- Improved wizard step and live score progress bars.

## v4.28.6 — Smooth Web Animations Polish

Added lightweight CSS-only micro-animations for web: cards, buttons, wizard content, payments, progress bars, modals, and focus states. Core logic was not touched.

## v4.29.37 release QA

Run the automated gate:

```bash
npm run qa:release
```

Then complete `qa/v4-29-37-full-mvp-scenario-matrix.md` and record the result in `qa/release-signoff-template.md`.


## v4.29.38 canonical decision truth

Frontend drafts and backend saved trips now use `shared/decision-engine.js` for the same readiness score and verdict rules. Run `npm run qa:release` before release.

## v4.29.39 country metadata snapshot

The backend now persists country metadata in `ExternalDataSnapshot`. The contextual recommendation CTA and the full **Improve Plan** wizard are separate controls: use the CTA for the exact edit target, and Improve Plan for broad trip editing.

## v4.29.40

FX rates now use a persistent backend snapshot resolver with Frankfurter as primary and safe fallbacks. The Available Money wizard step was reorganized so savings/support come first and currency details are collapsible.

## v4.29.41

Country Cost Ranges v1 plus Dashboard clarity:

- Low / Typical / High destination planning ranges
- backend cost-profile envelope with confidence and FX conversion
- Paid So Far / Still To Pay KPI clarity
- reduced Dashboard duplication
- clearer smart deep link vs full Improve Plan Wizard
- Trip Costs currency selector with guarded conversion


## v4.29.42 Recommendation Engine v1

Safaryaty now uses `shared/recommendation-engine.js` to rank a maximum of three explainable actions. Saved trips can retrieve the same contract from `GET /api/trips/:tripId/recommendations`. Recommendations consume canonical decision truth and cost ranges; they never recalculate salary, available cash, currency, or readiness.

## v4.29.43 — Unified Currency Domain

Safaryaty now has one central plan-currency editor, a Dashboard-only display preference and one shared deterministic currency domain. FX providers and snapshots resolve rates outside the finance engine. Saved-trip currency changes run through an atomic backend endpoint that preserves finance row IDs and PaymentMark records.

Run:

```bash
npm run qa:release
```

Then complete:

```txt
qa/v4-29-43-currency-regression-checklist.md
```

## v4.29.44 — Finance Truth Stabilization

Payment progress is now separate from affordability. Marking payments paid updates Paid So Far and Still To Pay without creating extra Ready Money or changing the trip funding gap.

Automated release check:

```bash
npm install
npm run qa:release
```

Manual checklist:

```txt
qa/v4-29-44-finance-truth-checklist.md
```


## v4.29.45 — UI Consistency & Modal Sizing

Cards now align by component family, controls share one height, and product modals use one responsive shell size. Finance logic is unchanged.

## v4.29.46 — Trip Costs & Suggestions Truth

Trip costs and suggestions now share one canonical category/frequency domain. Suggestion generation reconciles existing rows, apply is transactional, manual costs are protected, remove restores the suggestion, and daily costs retain their unit basis while appearing as one aggregated payment row.

Automated gate:

```bash
npm run qa:release
```

Manual checklist:

```txt
qa/v4-29-46-trip-costs-suggestions-checklist.md
```


## v4.29.47 — Compact Layout & Currency Deep Links

Trip Costs, Suggestions, Money In cards and Wizard managers now use natural content height instead of globally stretched grid rows. Trip-cost currency notices and the Suggestions header deep-link to the single Currency Setup inside Available Money.

Run:

```bash
npm install
npm run qa:release
```

Manual checklist:

```txt
qa/v4-29-47-layout-currency-deeplink-checklist.md
```


## v4.29.48 — Notification System & Action Feedback

Safaryaty now uses one typed, deduplicated notification queue. Deep-link navigation is silent, payment success offers Undo, loading belongs to the affected control, and user messages no longer expose backend implementation details.

Manual checklist:

```txt
qa/v4-29-48-notification-system-checklist.md
```

## v4.29.49 — Database Normalization Foundation

Core trip-level finance settings now have a normalized one-to-one `TripFinanceProfile`. Legacy `Trip.notes` remains readable during the transition.

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate:deploy
npm run db:backfill:finance-profile:dry
npm run db:backfill:finance-profile
```

## v4.29.50 — PostgreSQL Migration Readiness

The running project remains on SQLite. A separate PostgreSQL target schema, baseline, audit, migration-bundle exporter and checksum verifier are now included.

```bash
cd backend
npm run db:postgres:audit
npm run db:migration:bundle:export
npm run db:migration:bundle:verify -- --bundle=PATH_TO_BUNDLE
```

Do not switch `DATABASE_URL` or delete SQLite yet. Actual import and cutover are a separate controlled sprint.

## v4.29.51 — Controlled PostgreSQL Staging Cutover

A transactional PostgreSQL staging importer, verification receipt, guarded runtime switch, rollback-safe SQLite backup and rollback-only finance smoke are included. SQLite remains the default and production PostgreSQL runtime is blocked.

Start with:

```bash
cd backend
npm run db:postgres:audit
npm run db:cutover:source:backup
npm run db:postgres:staging:import -- --bundle=PATH_TO_BUNDLE
```

Read before execution:

```txt
backend/docs/postgresql-migration-runbook.md
qa/v4-29-51-controlled-postgresql-staging-checklist.md
```

## v4.29.52 — Suggestion Currency Parity

Trip-cost suggestions and Low/Typical/High ranges now originate from one destination-currency profile and are explicitly converted into the canonical Trip Currency. A failed conversion can no longer keep the same number and merely replace the currency label.

Before PostgreSQL staging, complete:

```txt
qa/v4-29-52-suggestion-currency-parity-checklist.md
```

## v4.29.52.1 — Backend Build Gate

A narrow pre-PostgreSQL patch fixes the seven backend TypeScript diagnostics found during Windows verification. No finance or database logic was changed. See:

```txt
docs/v4-29-52-1-backend-build-gate.md
qa/v4-29-52-1-backend-build-gate-checklist.md
```
