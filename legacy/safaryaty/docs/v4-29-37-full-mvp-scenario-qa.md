# Safaryaty v4.29.37 — Full MVP Scenario QA

## Purpose

This release introduces a formal release gate before external-data and deployment expansion. It does not change finance logic, APIs, Prisma schema, score rules, or UI behavior.

## Added

- `qa/v4-29-37-full-mvp-scenario-matrix.md`
- `qa/release-signoff-template.md`
- `qa/README.md`
- `scripts/qa-release-gate.mjs`
- `npm run qa:release`

## Coverage

Authentication, trip creation, currencies, money, commitments, trip costs, suggestions, emergency, payments, mark/undo paid, display switching, direct edits, deep links, score states, persistence, cross-page consistency, responsive smoke and a complete golden path.

## Release policy

Any P0 failure blocks the release. P1 failures also block unless explicitly reviewed and waived. Automated checks do not replace manual scenario testing.
