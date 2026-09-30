# PostgreSQL readiness schema

This directory is isolated from the active SQLite development schema.

- `schema.prisma` defines the proposed PostgreSQL target.
- money values use `Decimal(19,4)`;
- the planning exchange rate uses `Decimal(20,10)`;
- planning dates use PostgreSQL `DATE`;
- event/audit timestamps use `TIMESTAMPTZ(3)`;
- the baseline migration includes database checks and indexes not expressible in Prisma schema syntax.

Do not run PostgreSQL generation in the same deployment accidentally. It generates a separate client at:

```txt
backend/src/generated/postgresql-client
```

Required environment variable:

```env
POSTGRES_DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?schema=public"
```

Readiness commands:

```bash
npm run db:postgres:audit
npm run prisma:postgres:validate
npm run prisma:postgres:generate
npm run prisma:postgres:baseline:sql
```

Actual cutover/import is intentionally not part of v4.29.50.


Operational staging safety is added by a second migration:

```txt
202606230002_staging_cutover_receipt
```

It creates the PostgreSQL-only `MigrationReceipt` model used to bind the file verification receipt to the actual imported database. The original baseline is intentionally unchanged.
