# v4.29.50 — PostgreSQL Readiness Checklist

## Schema audit

- [ ] `npm run db:postgres:audit` returns `ready: true`.
- [ ] PostgreSQL schema has the same model and field set as SQLite.
- [ ] PostgreSQL schema contains no `Float` fields.
- [ ] Money fields use `Decimal(19,4)`.
- [ ] Exchange rate uses `Decimal(20,10)`.
- [ ] Planning dates use `DATE`.
- [ ] Audit/event timestamps use `TIMESTAMPTZ(3)`.
- [ ] PaymentMark remains unique by `(tripId, paymentKey)`.

## Baseline SQL

- [ ] Baseline is applied only to an empty PostgreSQL schema.
- [ ] Travelers and exchange rates have CHECK constraints.
- [ ] Monetary values reject negative values where appropriate.
- [ ] Trip return date cannot precede departure date.
- [ ] Currency codes are three uppercase letters.
- [ ] All foreign keys use the intended cascade behavior.
- [ ] Query-path indexes exist.

## Source preparation

- [ ] SQLite database has two backups.
- [ ] File hashes are recorded.
- [ ] Finance profile backfill reports no missing profiles.
- [ ] Application writes are stopped during final export.
- [ ] Sessions are intentionally included or excluded.

## Migration bundle

- [ ] Export completes without relation errors.
- [ ] Bundle verification returns `valid: true`.
- [ ] Each table has a count and SHA-256 checksum.
- [ ] Every monetary field has a decimal total.
- [ ] PaymentMark occurrence keys are unique.
- [ ] Bundle is stored encrypted/restricted because it contains user and authentication data.

## PostgreSQL target

- [ ] Target database is empty before baseline deployment.
- [ ] PostgreSQL Prisma schema validates.
- [ ] Isolated PostgreSQL client generates.
- [ ] Baseline deploy completes.
- [ ] Imported IDs exactly match source IDs.
- [ ] Target verifier reports no count/checksum/financial drift.

## Application parity after future import

- [ ] Login works.
- [ ] Trip list and detail counts match.
- [ ] Ready Money and Trip Plan Cost match SQLite.
- [ ] Paid So Far and Still To Pay match SQLite.
- [ ] Mark Paid and Undo preserve occurrence identity.
- [ ] Currency changes preserve economic values.
- [ ] Suggestions persist and do not duplicate.
- [ ] External snapshots retain freshness metadata.

## Rollback

- [ ] Previous backend release is available.
- [ ] SQLite backup remains untouched.
- [ ] Environment-variable rollback is documented.
- [ ] No dual-write reconciliation is assumed.
