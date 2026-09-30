# Verification gates — SDK 57 migration

No gate is "complete" without a concrete commit SHA, CI run URL, or dated device observation recorded in `decision-log.md`.

## Gate 1 — Baseline & backups (before PR 1 merge)

- [ ] `main` and `backup/pre-sdk57-2026-09-08` verified at `8988c271` (done 2026-09-08, GitHub API)
- [ ] Tag `sdk54-baseline` pushed
- [ ] Local bundle created and `git bundle verify` passed
- [ ] Device sync state checked (no unsynced records at risk) — or limitation consciously accepted and dated

## Gate 2 — Static (PR 1 branch)

- [ ] `npm ci` succeeds from committed lockfile, no `--force` / `--legacy-peer-deps` anywhere
- [ ] `npx expo-doctor` clean (or each warning dispositioned in decision-log)
- [ ] `npm run test:ci:static` green — includes source encoding, workspace structure, **core finance parity**, route foundation, trip workspace, auth contracts, active regression, mobile typecheck, mobile lint
- [ ] Financial parity test files unchanged (diff vs baseline is empty for `scripts/check-core-finance-parity.mjs` and active regression specs)

## Gate 3 — Full CI (PR 1)

- [ ] All five jobs green: quality, postgres-integration (incl. production migration safety, persistence, **recovery drill**, shadow channel), security (audit policy untouched), legacy, docker
- [ ] CI run URL recorded in decision-log

## Gate 4 — Device (after merge, before closing the migration)

On iPhone via Expo Go (SDK 57), tunnel from Windows:

- [ ] App loads (no SDK-mismatch error); record Expo Go version + iOS version
- [ ] Existing Clerk session restores OR sign-in→verification→session works end-to-end; sign-out works
- [ ] Trip data persists across app restart (SecureStore + server sync)
- [ ] Core funnel: create/complete setup → Today shows correct Ready Money / Need to Save / readiness; incomplete setup routes to first missing step (#53); UNKNOWN never renders as zero (#63); Today coverage uses remaining unpaid cost (#65); exact overdue payment deep link opens focused action (#67)
- [ ] Arabic RTL + English LTR render correctly; dates per local-calendar truth (#57)
- [ ] Animations (Reanimated 4.5) and FlashList scrolling: no crashes, no visual breakage
- [ ] No P0/P1 regression → Issue #55 unblocked

## Explicitly out of scope for green-CI claims

CI does not exercise: native iOS rendering, gesture behavior, Expo Go runtime, Clerk native token cache, RTL layout on device. Green CI is evidence only for what its tests run (rule 4). Device gate is the only evidence for those.
