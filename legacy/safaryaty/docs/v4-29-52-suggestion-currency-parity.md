# Safaryaty v4.29.52 — Suggestion Currency Parity

## Defect

Changing the canonical Trip Currency converted selected TripCost rows, but suggestion ranges could keep the same nominal numbers and only change the currency label.

Example of the invalid behavior:

```txt
Typical estimate: 870 BHD
Change Trip Currency to AED
Typical estimate: 870 AED   ← invalid relabelling
```

The estimate represents one economic value. Its numeric amount must change when its currency changes.

## Root causes

1. Local suggestion generation passed the selected Trip Currency directly into a destination profile instead of generating one native profile and converting it.
2. Bahrain and several GCC currencies were absent from the backend local metadata fallback.
3. The backend suggestion engine generated its own nominal target-currency profile instead of consuming the converted cost-profile adapter output.
4. Previous backend suggestion/range state remained visible during refresh after a currency change.
5. A failed backend FX conversion replaced the native profile with a generic target-currency profile, which could preserve the same number under a different label.

## Correct flow

```txt
Destination profile in native destination currency
→ resolve explicit native → Trip Currency rate
→ convert category estimates and Low/Typical/High ranges once
→ generate or update suggestions in Trip Currency
→ persist/display only after currency validation
```

## Safety rules

- A number is never relabelled with another currency without a valid rate.
- Saved trip `rateBook` is preferred for deterministic regeneration.
- The backend FX resolver is the secondary conversion source.
- When no rate exists, native estimates are returned as native and rejected by target-currency suggestion persistence.
- Existing selected costs remain handled by the atomic currency-context transaction.
- Stale backend suggestion/range state is cleared while the new currency result loads.
- Frontend defensively converts a stale row only when its explicit source currency and a saved rate are available.

## Implementation

Added:

```txt
shared/cost-estimate-currency.js
shared/cost-estimate-currency.d.ts
src/costEstimateResolver.js
```

Updated:

```txt
src/main.jsx
src/engine.js
backend/src/modules/external/costProfile.adapter.ts
backend/src/modules/external/countryMetadata.adapter.ts
backend/src/modules/suggestions/suggestions.engine.ts
backend/src/modules/suggestions/suggestions.routes.ts
```

No Prisma schema or financial formula change was made.
