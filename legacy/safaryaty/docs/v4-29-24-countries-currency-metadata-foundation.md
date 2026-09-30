# Safaryaty v4.29.24 — Countries & Currency Metadata Foundation

## Goal

Prepare Safaryaty for external-world data without making the current MVP dependent on live country APIs yet.

## Added

- `src/data/countryMetadata.js`
- Expanded supported currency metadata list.
- Country profile helper with:
  - region
  - default currency
  - rough cost tier
  - travel tags
- Currency dropdowns now use metadata-backed options.
- Currency options show origin/destination metadata hints.
- Tests ensure route country currencies are supported by metadata.

## Not changed

- FX API behavior.
- Currency conversion logic.
- Trip currency change conversion.
- Backend contracts.
- Prisma schema.
- Score logic.
- Suggestions generation logic.

## Why this matters

This creates a clean foundation for the next steps:

1. Country/currency backend metadata endpoint.
2. Admin-managed country cost profiles.
3. Cost-profile recommendation engine.
4. Flight estimate adapter.
5. Recommendation intelligence.

## Rule

Country metadata can suggest defaults, but it must not calculate readiness, score, or payment truth. Those remain in the existing calculation engines.
