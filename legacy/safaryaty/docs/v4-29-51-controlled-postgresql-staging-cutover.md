# Safaryaty v4.29.51 — Controlled PostgreSQL Import & Staging Cutover

## Scope

This release implements the real PostgreSQL importer and a guarded PostgreSQL runtime for **staging only**.

SQLite remains the default runtime. Production PostgreSQL cutover is deliberately blocked.

## Safety model

The staging sequence is mandatory:

```txt
SQLite write freeze
→ verified SQLite backup
→ finance-profile backfill check
→ migration bundle export
→ bundle checksum verification
→ empty PostgreSQL baseline
→ guarded dry run
→ checksum-confirmed transactional import
→ in-transaction parity check
→ post-commit parity check
→ verification receipt
→ rollback-only staging smoke
→ guarded PostgreSQL backend runtime
```

A missing or failed step blocks the next one.

## Source protection

`db:cutover:source:backup` refuses to run while the backend port is reachable and requires:

```txt
--execute --ack=SAFARYATY_SOURCE_WRITES_STOPPED
```

The backup copies:

- the primary SQLite database;
- `-wal`, when present;
- `-shm`, when present.

Every copied file receives a SHA-256 hash in the backup receipt.

Rollback verification rechecks every hash and opens the backup with the SQLite Prisma client before approving it.


## Migration compatibility

The v4.29.50 baseline is not edited. v4.29.51 adds a second forward-only migration:

```txt
202606230001_postgresql_baseline
202606230002_staging_cutover_receipt
```

This keeps Prisma migration history valid for targets that already applied the v4.29.50 baseline.

## Import protection

The importer is dry-run by default.

Execution requires all of:

```txt
NODE_ENV != production
POSTGRES_TARGET_KIND=staging
POSTGRES_STAGING_ACK=SAFARYATY_POSTGRES_STAGING_VERIFIED
--execute
--confirm=<exact bundle global checksum>
```

It also verifies:

- PostgreSQL 14 or newer;
- the baseline Prisma migration is successfully applied;
- every application table is empty;
- the bundle relation and checksum validation passes;
- row count is below the default guarded transaction limit unless explicitly reviewed.

## Transactional importer

The import:

- preserves every ID;
- preserves timestamps;
- materializes planning dates as UTC midnight into PostgreSQL `DATE`;
- passes money values as decimal strings;
- inserts in foreign-key dependency order;
- batches `createMany` calls;
- takes a PostgreSQL advisory transaction lock;
- runs at Serializable isolation;
- recomputes counts, table checksums, financial totals and relation validation **inside the transaction**;
- throws and rolls back if one value differs.

A second verification runs after commit. Runtime remains blocked unless that verification produces a valid receipt.

The PostgreSQL-only `MigrationReceipt` operational model is written inside the same transaction after parity succeeds. On every PostgreSQL backend start, the file receipt and database marker must agree on both bundle checksum and target fingerprint. This prevents a verified receipt from being reused after the staging database is reset or replaced.

## Runtime switch

`DATABASE_PROVIDER=sqlite` remains the default.

PostgreSQL runtime additionally requires:

```txt
POSTGRES_DATABASE_URL
POSTGRES_TARGET_KIND=staging
POSTGRES_STAGING_ACK=SAFARYATY_POSTGRES_STAGING_VERIFIED
POSTGRES_VERIFICATION_RECEIPT
```

The receipt must:

- allow runtime;
- contain source/target checksum parity;
- match the fingerprint of the configured PostgreSQL host, port, database and schema.

Credentials are excluded from the fingerprint and reports.

The PostgreSQL Prisma client is generated separately under:

```txt
backend/src/generated/postgresql-client
```

The active SQLite client is not replaced.

## Decimal compatibility boundary

PostgreSQL stores financial values as `Decimal`, while the current finance engines operate on JavaScript numbers.

The PostgreSQL runtime client applies one query-result boundary that:

- converts Prisma Decimal values to finite numbers;
- leaves `Date` objects unchanged;
- rejects values outside JavaScript safe integer boundaries.

Provider and database code remain outside finance formulas.

## Staging smoke

`db:postgres:staging:smoke` creates a temporary user and plan inside one Serializable transaction, then verifies:

- PostgreSQL CRUD;
- Decimal conversion boundary;
- finance summary values;
- PaymentMark occurrence behavior;
- `Paid + Still To Pay = Total Tracked Outgoings`;
- Mark Paid does not change Ready Money, Trip Plan Cost, Need To Save or After-Trip Position.

The script intentionally rolls the transaction back and verifies that no smoke records remain.

## Production status

Production PostgreSQL runtime is explicitly rejected in this version. No production database switch, dual-write or production data mutation is included.
