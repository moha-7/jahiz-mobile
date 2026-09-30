# Safaryaty v4.29.52.1 — Backend Build Gate & Finance Exactness

This patch is intentionally narrow. It fixes the seven TypeScript compilation errors discovered during the mandatory SQLite release gate before PostgreSQL staging.

## Fixes

- narrows external FX confidence to `low | medium | high` before ranking;
- preserves Zod-validated required fields when converting date strings;
- uses Prisma's checked `user.connect` relation when creating a Trip with nested `financeProfile`;
- updates backend health metadata to `4.29.52.1`.

No finance formula, currency amount, PaymentMark behavior, database schema or migration was changed.

## Required Windows verification

```powershell
cd backend
npm run prisma:generate
npm run prisma:validate
npm run build
npm run test:external
```

Then run the backend and verify health from another PowerShell window:

```powershell
npm run dev
npm run test:health
```

Do not start PostgreSQL migration until the backend build reports zero TypeScript errors.
