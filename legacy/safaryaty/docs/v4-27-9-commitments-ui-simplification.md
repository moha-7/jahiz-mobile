# Safaryaty v4.27.9 — Commitments UI Simplification

## Goal

Improve UI/UX gradually without touching the core engines:

- `engine.js`
- `payments.js`
- `canTravel.js`
- trip intent logic
- dynamic destination categories
- installments core behavior

## What changed

### 1. Wizard is shorter

The wizard now shows one combined step for commitments:

```txt
Existing Commitments
```

Inside it, the app still keeps two separate data structures:

```txt
lifeCosts
installments
```

So the UI is simpler, but the core remains intact.

### 2. Installments remain core

Installments are now presented as:

```txt
Monthly Payments
```

Presets added:

- Tabby
- Tamara
- Credit Card
- Loan
- Car Installment
- Phone Installment
- Education Payment
- Other

### 3. Technical fields hidden from normal user

Destination cost metadata is still preserved internally:

- `costType`
- `currencyScope`

But the normal user no longer edits these directly in the main flow.

### 4. Commitments summary

The combined step shows quick totals:

- Origin commitments
- Monthly payments

This makes the step easier to understand before the user opens detailed cards.

## Not changed

- No core engine changes.
- No removal of installments.
- No backend schema changes.
- No change to score / canTravel logic.
- No change to To Pay engine.

## Next

v4.28.0 should be a testing and stability sprint, unless UI/UX polish finds urgent friction.
