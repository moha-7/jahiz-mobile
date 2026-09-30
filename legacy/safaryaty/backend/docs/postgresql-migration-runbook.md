# PostgreSQL Controlled Staging Runbook — v4.29.51

This runbook is staging-only. Production PostgreSQL runtime is blocked by code.

## 1. Install and generate clients

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:postgres:validate
npm run prisma:postgres:generate
```

## 2. Stop SQLite writes and create rollback backup

Stop the backend first, then:

```bash
npm run db:cutover:source:backup -- \
  --execute \
  --ack=SAFARYATY_SOURCE_WRITES_STOPPED
```

Copy the printed receipt path and verify it:

```bash
npm run db:rollback:sqlite:verify -- --receipt=PATH_TO_BACKUP_RECEIPT
```

## 3. Validate and export source

```bash
npm run db:backfill:finance-profile:dry
npm run db:postgres:audit
npm run db:migration:bundle:export -- --output=./migration-bundles/staging-candidate
npm run db:migration:bundle:verify -- --bundle=./migration-bundles/staging-candidate
```

Sessions are excluded by default.

## 4. Prepare isolated PostgreSQL staging

Local Docker option:

```bash
docker compose -f docker-compose.postgresql-staging.yml up -d
```

Configure:

```env
POSTGRES_DATABASE_URL="postgresql://safaryaty:safaryaty_staging_only@127.0.0.1:55432/safaryaty_staging?schema=public"
POSTGRES_TARGET_KIND=staging
POSTGRES_STAGING_ACK=SAFARYATY_POSTGRES_STAGING_VERIFIED
NODE_ENV=staging
```

Apply the baseline and the separate v4.29.51 receipt migration:

```bash
npm run prisma:postgres:migrate:deploy
```

The importer requires the target application tables to be empty.

## 5. Import dry run

```bash
npm run db:postgres:staging:import -- \
  --bundle=./migration-bundles/staging-candidate
```

Record the printed global checksum.

## 6. Execute guarded import

```bash
npm run db:postgres:staging:import -- \
  --bundle=./migration-bundles/staging-candidate \
  --execute \
  --confirm=PASTE_EXACT_GLOBAL_CHECKSUM
```

The command writes a verified receipt under `migration-reports/` and a matching `MigrationReceipt` row inside PostgreSQL. Both are required for runtime.

## 7. Verify receipt and target

Set:

```env
POSTGRES_VERIFICATION_RECEIPT="./migration-reports/RECEIPT_FILE.json"
```

Then:

```bash
npm run db:postgres:staging:receipt:verify
npm run db:postgres:target:verify -- \
  --bundle=./migration-bundles/staging-candidate
```

## 8. Rollback-only database smoke

```bash
npm run db:postgres:staging:smoke
```

The smoke transaction must report `rolledBack: true`.

## 9. Start the backend against PostgreSQL staging

Development:

```bash
npm run dev:postgres:staging
```

Built server:

```bash
npm run build
npm run start:postgres:staging
```

Use a separate staging port, cookie name and upload directory.

## 10. Rollback rehearsal

Stop the PostgreSQL staging backend. Restore the prior SQLite environment:

```env
DATABASE_PROVIDER=sqlite
DATABASE_URL="file:./dev.db"
```

Use the verified backup as the source when rehearsing rollback. Do not reconcile independent SQLite and PostgreSQL writes manually.

## Never do these in v4.29.51

- set `NODE_ENV=production` with `DATABASE_PROVIDER=postgresql`;
- import into a non-empty PostgreSQL target;
- bypass the checksum confirmation;
- start PostgreSQL runtime without a valid receipt;
- delete the SQLite backup;
- run both databases as independent writable production systems.
