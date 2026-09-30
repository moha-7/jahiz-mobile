# SDK 57 Migration Reference — JAHIZ

**Status:** PLANNED (audit + decision complete; no dependency changes applied yet)
**Last updated:** 2026-09-08
**Resume phrase:** «ارجع لمرجع SDK57» — read this directory top to bottom, then check `decision-log.md` for the latest state.

## Objective

Restore iPhone device testing. The installed Expo Go on the user's iPhone requires SDK 57 and no longer opens the SDK 54 project. Same product behavior, same financial truth, full CI green, then Issue #55 (final core-funnel device verification).

## Verified baseline (2026-09-08)

| Ref | SHA |
|---|---|
| `main` | `8988c2718762b4e147afe1a799319a9a3cc9924b` |
| `backup/pre-sdk57-2026-09-08` | `8988c2718762b4e147afe1a799319a9a3cc9924b` (same as main) |
| `chore/sdk57-migration-plan` | `8988c2718762b4e147afe1a799319a9a3cc9924b` (no commits yet) |

- Last main CI run: **CI run 144, success**, head `8988c27` (PR #67) — https://github.com/moha-7/Jahiz/actions/runs/33870116825
- Branch protection: none (traditional protection disabled; rulesets API returns 403 "Upgrade to GitHub Pro" — rulesets are not available on this free private repo, so no ruleset protection exists either).
- Open PRs: Dependabot only (#2–#12, #19). None touch the migration. **Do not merge #10 (react-native-worklets 0.11.3)** — the worklets version must be the Expo-pinned pair (0.10.1), not latest.

## The decision (see decision-log.md for full evidence)

**Direct upgrade SDK 54 → SDK 57 in one platform PR**, with:

- `@clerk/expo` **3.4.2 → 3.7.8** (stays on v3 API; 3.7.0+ widened the peer range to `expo >=53 <58`; avoids the v4 major migration entirely)
- `tamagui` **2.4.6 kept** (peer is only `react >=19`; upgrade to 2.7.x only if runtime breakage is proven)
- All `expo-*` packages + `expo-router` to the unified `~57.0.x` line via `npx expo install --fix`
- Known code changes: remove `newArchEnabled` from app.json; run the SDK 56 router codemod on the 4 files importing `@react-navigation/*`

Why not sequential 54→55→56→57: the user's Expo Go runs **only SDK 57**, so intermediate SDKs have no device-verifiable checkpoint; SDK 55/56 Expo Go was never on the App Store. Intermediate breaking changes are enumerated and statically checkable instead (see `compatibility-matrix.md`).

## Files

- `baseline.md` — frozen SDK 54 dependency snapshot + refs
- `compatibility-matrix.md` — per-dependency targets with evidence
- `backup-restore.md` — code/data backup and rollback
- `migration-plan.md` — PR sequence and exact steps
- `verification.md` — gates that must pass before merge
- `decision-log.md` — dated decisions with evidence

## PR sequence

1. **PR 0 (this branch):** docs only — this directory. No runtime changes.
2. **PR 1:** platform dependency migration (SDK 57 + Clerk 3.7.8 + codemod + app.json), lockfile committed, full CI.
3. **PR 2 (only if needed):** isolated fixes proven necessary by CI or device testing (Tamagui bump, adapter shims).
4. **Gate:** device verification on iPhone via Expo Go (SDK 57), then Issue #55.

## Known constraints of this environment

- The GitHub connector available to the assistant on 2026-09-08 was **read-only** (no branch/PR/issue creation; Issues API returned 403 for the PAT). Docs and commands are therefore prepared for local execution; a session with write access can execute directly.
- Master tracking issue: not yet created (blocked by the same 403). Body prepared at the bottom of `migration-plan.md`.
