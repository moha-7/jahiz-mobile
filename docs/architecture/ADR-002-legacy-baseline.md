# ADR-002 — Preserve the verified Safaryaty baseline

- **Status:** Accepted

## Decision

The verified Safaryaty source is preserved under `legacy/safaryaty` and patched to `4.29.52.1` using the supplied build-gate, built-server path and runtime build-layout hotfixes.

The new Jahiz product is built beside it. No mass rebrand or backend rewrite is allowed during Sprint 0.

## Safety rules

1. Finance calculations are copied byte-for-byte into `@jahiz/core-finance`.
2. CI checks byte parity until behavioral parity tests replace the temporary checksum gate.
3. PostgreSQL migration receipts and runtime safety checks remain enabled.
4. Existing Prisma migrations are immutable.
5. Intentional finance changes require a separate ADR, regression fixtures and explicit approval.
