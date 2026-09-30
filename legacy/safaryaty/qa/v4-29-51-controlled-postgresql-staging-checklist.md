# v4.29.51 — Controlled PostgreSQL Staging Checklist

Do not run against production.

## A. Source freeze and rollback backup

- Stop the SQLite backend and every other writer.
- Run the backup command with the exact acknowledgment.
- Confirm the receipt includes the primary DB and any WAL/SHM companions.
- Run rollback verification.
- Record the SQLite backup SHA-256.

Expected: every hash passes and the backup is readable.

## B. Source data readiness

- Run finance-profile dry-run backfill.
- Confirm missing profiles = 0.
- Export migration bundle without sessions unless session transfer is deliberately approved.
- Verify bundle.

Expected: relation errors = 0 and checksum verification passes.

## C. Empty target

- Create an isolated staging PostgreSQL database.
- Apply only the PostgreSQL baseline migration.
- Confirm target application tables contain zero rows.
- Do not start the application against it yet.

## D. Import dry run

Run the importer without `--execute`.

Expected:

- correct target fingerprint;
- target empty;
- baseline applied;
- row counts shown;
- exact checksum required for execution.

## E. Transactional import

Run with:

```txt
--execute --confirm=<exact checksum shown by dry run>
```

Expected:

- all inserted counts match;
- in-transaction verification passes;
- post-commit verification passes;
- receipt is written;
- receipt global checksums match;
- `MigrationReceipt.initial-sqlite-import` exists and matches the file receipt.

## F. Receipt and target verification

- Run target verifier again independently.
- Verify the receipt against the configured target URL.

Expected: target fingerprint, row counts, table checksums, financial totals and global checksum all match.

## G. Rollback-only database smoke

Run the PostgreSQL staging smoke.

Expected:

- Ready Money = 700 in the fixture;
- Trip Plan Cost = 500;
- initial Paid = 0 and Still = 800;
- after Mark Paid, Paid = 500 and Still = 300;
- affordability values remain unchanged;
- smoke transaction rolls back;
- no smoke user remains.

## H. Backend staging runtime

Start on a different port with the verification receipt.

Test:

- `/api/health` reports `databaseProvider=postgresql`;
- `/api/health/database` reports reachable;
- registration/login;
- trip list/read;
- finance summary;
- Mark Paid and Undo;
- currency display and actual currency conversion;
- suggestion generate/apply/remove/reload;
- logout/login persistence.

## I. Rollback rehearsal

- Stop PostgreSQL staging backend.
- start the previous SQLite configuration using the verified backup;
- run health and core flows;
- confirm no attempt is made to merge independent writes.

## Approval gate

Do not plan production cutover unless all sections pass with evidence and zero financial checksum differences.
