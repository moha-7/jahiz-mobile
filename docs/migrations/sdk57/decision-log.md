# Decision log — SDK 57 migration

## 2026-09-08 — Route decision: direct 54→57, Clerk stays on v3

**State verified today (GitHub API):** main = backup/pre-sdk57-2026-09-08 = chore/sdk57-migration-plan = `8988c2718762b4e147afe1a799319a9a3cc9924b`; last main CI run 144 green; no branch protection and no rulesets (API 403 = feature unavailable on free private repo); open PRs are Dependabot-only.

**Decision 1 — Target = SDK 57 directly (expo ~57.0.20).**
Evidence: SDK 57 released 2026-06-30 (RN 0.86.2, React 19.2.3), marketed as no-breaking-change on top of 56; SDK 55/56 Expo Go never reached the App Store, and the user's App Store Expo Go now demands SDK 57 — so intermediate SDKs (55.0.31, 56.0.21, both on npm) offer no device-verifiable checkpoint. Cumulative 54→57 breaking changes were enumerated from the three changelogs and checked against the actual codebase: only two apply — (a) router/react-navigation decoupling (4 files, codemod available), (b) `newArchEnabled` key removal (app already on New Arch). No usage of expo-av, expo-blur, expo-file-system, ExpoRequest/Response. `expo/fetch`-as-global is a watch item, not a known break.
Alternative rejected: sequential 54→55→56→57 — three lockfile churns, three CI cycles, zero device checkpoints, same final diff.

**Decision 2 — @clerk/expo 3.4.2 → 3.7.8 (NOT 4.x).**
Evidence (npm peerDependencies, verified 2026-09-08): every 3.x ≤3.6.5 caps `expo <57`; **3.7.0–3.7.8 allow `expo >=53 <58`**; 4.x (first release 2026-07-21, latest 4.6.5) also allows `<58` but is a major with API changes. Staying on the v3 line keeps auth adapter code and on-device token-cache semantics unchanged. Clerk 4.x migration is deliberately deferred until after PMF gate work; revisit only if 3.7.8 fails on device.

**Decision 3 — Tamagui 2.4.6 kept.**
Evidence: `tamagui@2.4.6` peers = `react >=19` only (npm, verified); React 19.2.3 satisfies it; package is JS-level. Bump to 2.7.7 only on demonstrated breakage (would be PR 2, logged here).

**Decision 4 — Worklets/Reanimated follow Expo pins (0.10.1 / 4.5.1), not npm latest.**
Consequence: Dependabot #10 (worklets 0.11.3) must be closed unmerged.

**Blocker recorded:** the GitHub connector in the 2026-09-08 session was read-only (no PR/issue/branch-content writes; Issues API 403 for the PAT — issues #55/#58/#59 could not even be read this session). PR 0 content prepared for local commit; master issue body staged in migration-plan.md.

**Estimate (bounded, not a commitment):** PR 0 same day; PR 1 one focused session (0.5–1 day) given the small enumerated breaking surface; device gate 0.5 day. Slips would come from Tamagui/RN 0.86 rendering or Clerk device-session restore — both listed as UNKNOWN until observed.

## 2026-09-08 — Gate 1 (baseline & backups) CLOSED — verified evidence

- Refs: main = backup/pre-sdk57-2026-09-08 = `8988c271` (GitHub API).
- Tag `sdk54-baseline` → `8988c271` pushed to origin (GitHub API, list_tags).
- Bundle `C:\Dev\jahiz-sdk54-baseline.bundle` (2,825,540 bytes, created 2026-09-08 12:02Z):
  `git bundle verify` = "okay … records a complete history", contains
  `refs/heads/main` → `8988c2718762b4e147afe1a799319a9a3cc9924b`.
  SHA-256: `de2b4b8bc045febbeb543c7a5f30a85dfc1db54bf9817f88aee459e2d7398b3c`.
  (Created against `main` pre-merge — content identical to tag `sdk54-baseline`.)
- Device-data item: consciously deferred, dated 2026-09-08 — this migration performs
  no destructive device-data operation by design (Clerk stays on v3 line, no storage
  schema change); iPhone data will not be touched before the device gate.
- CI on PR #69: run 145 green (`4051ae1`), run 146 green (`3e6c783`).

## 2026-09-09 — PR #70 merged as SDK 57 baseline — verified evidence

- PR #70 (`chore/sdk57: migrate mobile platform dependencies`) was merged into `main`.
- Merge commit: `226f154c1c10a5ee25f0f92979228855fffb5642`.
- PR head before merge: `2830a0987238ee3f321cdb2e48ac46d2a4614f09`.
- Main after merge: `226f154c1c10a5ee25f0f92979228855fffb5642`.
- GitHub CI run #151 on `main` completed successfully after the merge.
- Local `main` was fast-forwarded from `8988c27` to `226f154`.
- Local `npm run mobile:typecheck` passed on merged `main`.
- Local `npm run test:ci:static` passed on merged `main`.
- Active regression suite on merged `main`: 331 tests, 331 pass, 0 fail.
- `mobile:lint` remains non-blocking with 52 warnings and 0 errors.

### Accepted post-merge follow-ups

- `typedRoutes` remains temporarily disabled because Expo Router typed-route generation failed in the monorepo with `Cannot find module 'expo-router/_ctx-shared'`.
- `expo-doctor` duplicate `expo-constants@57.0.17` remains a release-gate follow-up before any EAS/development build.
- React Hooks SDK 57 warnings remain visible but non-blocking; they must be cleaned screen-by-screen in a follow-up PR.
- Moderate transitive npm audit findings remain documented; do not run `npm audit fix --force`.

### Current baseline decision

SDK 57 is now the official development baseline on `main`.

Feature work may continue from `main`, but the SDK migration itself is not considered fully closed until Device Gate 4 verifies:
- Clerk session restore / sign-in / sign-out.
- Account-scoped local persistence.
- Core financial funnel truth on device.
- Ready Money and Bookings deep-link behavior.
- RTL/LTR behavior.
- Animation and list responsiveness on device.
