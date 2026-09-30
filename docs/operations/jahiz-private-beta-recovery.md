# JAHIZ Private Beta Recovery Gate

This document defines the minimum recovery evidence required before JAHIZ stores real private-beta financial/trip data in a cloud PostgreSQL environment.

## What the repository proves

The CI recovery acceptance test performs a real logical PostgreSQL backup and restore using `pg_dump` and `pg_restore`.

The drill verifies that a restored empty database preserves:

- internal user ownership;
- provider identity links;
- active, archived and deleted trips;
- canonical revisions;
- mutation identity and mutation kind history;
- terminal deleted tombstones;
- migration ledger names and SHA-256 checksums;
- owner foreign-key protection;
- post-restore writeability and revision continuation;
- zero pending migrations after restore.

This is a recovery-mechanics proof. It is not proof that a future managed production database has PITR enabled.

## Real private-beta deployment gate

Before real-user cloud private beta, record evidence for the actual database environment:

1. Managed database provider and region are explicitly selected.
2. Automated backups are enabled.
3. Point-in-time recovery is enabled where the selected provider supports it.
4. Backup retention is documented.
5. Backup encryption at rest is enabled through the provider/platform.
6. A restore is executed from the actual environment into an isolated recovery target.
7. Restored JAHIZ data passes the same canonical checks exercised by the repository recovery acceptance test.
8. The restore operator records the recovery start/end timestamps and any manual steps.
9. The recovered environment is destroyed or secured after verification.
10. A named rollback/restore owner exists for the beta release.

## Provisional recovery objectives

These are internal engineering targets, not external guarantees:

- RPO: use the smallest practical managed-PITR window supported by the selected beta database plan.
- RTO: measure during the first real-environment restore drill; do not publish an unmeasured target.

## Data handling

Database backups contain sensitive trip and financial data.

They must not be:

- committed to Git;
- uploaded to public CI artifacts;
- copied into analytics/log streams;
- retained on developer machines without a deliberate need and secure handling.

The CI acceptance dump is temporary, contains synthetic data only, and is deleted before the test exits.

## Remaining deployment decision

The actual managed PostgreSQL provider/PITR configuration remains a deployment decision until a real private-beta environment is selected. Do not mark production recovery as VERIFIED from the CI drill alone.
