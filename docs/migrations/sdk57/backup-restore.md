# Backup & rollback — SDK 57 migration

## Source code (VERIFIED)

- `backup/pre-sdk57-2026-09-08` = `8988c2718762b4e147afe1a799319a9a3cc9924b` (identical to main at baseline). Verified via GitHub API 2026-09-08.
- Branch protection/rulesets: none exist (free private repo; rulesets API 403). An immutable tag is therefore advisory, not enforced — still create one:

```powershell
git -C C:\Dev\Jahiz tag -a sdk54-baseline 8988c2718762b4e147afe1a799319a9a3cc9924b -m "SDK 54 baseline before SDK 57 migration"
git -C C:\Dev\Jahiz push origin sdk54-baseline
git -C C:\Dev\Jahiz bundle create ..\jahiz-sdk54-baseline.bundle sdk54-baseline
git -C C:\Dev\Jahiz bundle verify ..\jahiz-sdk54-baseline.bundle
```

The bundle lands OUTSIDE the working tree (`C:\Dev\jahiz-sdk54-baseline.bundle`). Do not run any of this over a working tree with uncommitted changes — `git status` must be clean first.

## PostgreSQL / server data

Production reality at baseline: PostgreSQL is exercised in CI via a disposable `postgres:16-alpine` service with CI-only credentials; the repo's production recovery drill (`test:production:recovery`, pg_dump/pg_restore) is the existing, tested mechanism. **No deployed production database has been identified in this audit** — if one exists outside CI, run the recovery drill's dump against it before PR 1 merges and record the artifact location here (never in the repo). If none exists, this section is satisfied by CI's recovery drill remaining green.

## Device-local data (iPhone)

Storage inventory (from manifests): `expo-secure-store` (Clerk token cache via @clerk/expo), no SQLite/AsyncStorage/filesystem packages declared in apps/mobile.

- **Expo Go owns the app sandbox.** Do NOT delete Expo Go, clear its data, or uninstall to "fix" the SDK mismatch — that destroys local state.
- SecureStore data is keyed per Expo Go project sandbox; the SDK 54→57 runtime switch happens inside the same Expo Go app once it updates. Clerk session restoration after upgrade is an explicit verification item, not an assumption.
- There is **no export mechanism** in the current app for device-local state. Limitation recorded: if the device holds unsynced records, they cannot be backed up out-of-band today. Mitigation: server persistence (M9.4/M9.5) is the source of truth for synced trips; verify sync status on device BEFORE upgrading Expo Go if possible.

## Rollback

1. **Code:** `git checkout backup/pre-sdk57-2026-09-08` (or tag `sdk54-baseline`) in a separate worktree; `npm ci` restores the exact SDK 54 dependency set from the committed lockfile.
2. **Runtime reality:** the App Store Expo Go that forced this migration may no longer run SDK 54. Rollback of code does NOT restore an SDK 54-capable device runtime. If rollback is needed post-upgrade, device testing falls back to web (`npm run mobile:web`) until re-migration.
3. **Data:** no destructive data migration is part of this plan; Clerk/SecureStore schema is unchanged by design (v3 Clerk line kept). Any future destructive migration requires a verified export/restore first — none is authorized here.
