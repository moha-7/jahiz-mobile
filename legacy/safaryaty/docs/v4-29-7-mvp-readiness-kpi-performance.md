# Safaryaty v4.29.7 — MVP Readiness + KPI Performance Pass

## Goal

Stabilize the visible product experience before deeper MVP testing.

## Changes

- KPI labels clarified:
  - Ready Money
  - Trip Plan Cost
  - Need to Save
  - Paid Already
- Mark Paid / Undo avoids an extra backend summary request when the mutation already returns a fresh summary.
- Backend summary fallback state duplicate update removed.
- Saved trips remain backend-first.
- Demo / draft trips remain local preview only.

## Not changed

- No engine formula changes.
- No Prisma schema changes.
- No route picker changes.
- No wizard flow changes.
- No payment contract changes.

## Why

This patch protects precision first, then reduces unnecessary backend refresh work where safe.
