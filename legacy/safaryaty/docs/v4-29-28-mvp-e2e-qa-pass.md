# Safaryaty v4.29.28 — MVP End-to-End QA Pass

## Scope

No new feature sprint. This release adds QA coverage and hardens deletion reconciliation.

## Changes

- Added `qa/mvp-e2e-master-flow.md` for the full manual MVP flow.
- Added engine tests proving trip costs affect readiness and need-to-save.
- Added tight-plan test: covered plan with low leftover stays explainable.
- Backend finance item DELETE is now idempotent when the item is already gone, returning success with `alreadyRemoved: true` instead of surfacing a scary error.

## Protected

- No currency conversion changes.
- No suggestion generation changes.
- No Prisma schema changes.
- No API contract breaking changes.
- No score formula rewrite.

## Why

Before adding external travel APIs and Docker workers, the MVP flow must prove that trip costs, score, payment state, currency conversion, and saved-trip persistence are coherent.
