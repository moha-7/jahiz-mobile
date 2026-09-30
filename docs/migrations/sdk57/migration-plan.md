# Migration plan — SDK 54 → 57, one platform stage

Decision rationale: see `decision-log.md` (2026-09-08 entry). Route: **direct to SDK 57**; sequential 54→55→56→57 rejected because no intermediate SDK is device-verifiable in the user's Expo Go, and every intermediate breaking change is enumerated and statically checkable.

## PR 0 — this docs directory (no runtime changes)

Branch `chore/sdk57-migration-plan` (exists at baseline SHA, empty). Commit `docs/migrations/sdk57/`, open PR, merge on green CI (docs-only).

## PR 1 — platform dependency migration

Branch: `chore/sdk57-platform` off main. On the Windows machine (`C:\Dev\Jahiz`), clean tree, Node ≥22.19:

```powershell
cd C:\Dev\Jahiz
git status                       # must be clean
git checkout -b chore/sdk57-platform
# 1. Clerk first (independent minor bump, v3 line kept):
npm --workspace @jahiz/mobile install @clerk/expo@3.7.8
# 2. Expo platform:
npm --workspace @jahiz/mobile install expo@^57.0.0
npx --workspace @jahiz/mobile expo install --fix
# 3. Router/react-navigation decoupling codemod (SDK 56 change):
npx expo-codemod sdk-56-expo-router-react-navigation-replace apps/mobile/src
# 4. Root react/react-dom devDeps -> 19.2.3 (match mobile):
npm install -D react@19.2.3 react-dom@19.2.3
# 5. Health checks:
npx --workspace @jahiz/mobile expo-doctor
npm run mobile:typecheck
npm run mobile:lint
npm run test:ci:static
```

Manual edits expected in the same PR:
- `apps/mobile/app.json`: delete `"newArchEnabled": true` (key removed from schema in SDK 55; app already runs New Architecture).
- Review the codemod diff on the 4 files (`jz-focus-highlight.tsx`, `screen.tsx`, `jz-collapsible-screen.tsx`, `jz-premium-tab-bar.tsx`) — navigation is core-funnel; no drive-by refactors.
- Verify `experiments` block against expo-doctor output (typedRoutes / reactCompiler).
- Commit `package-lock.json`. **No `--force`, no `--legacy-peer-deps`.** If peer resolution fails, stop and record the conflict in decision-log.md instead of overriding.

Financial contracts: zero changes to `packages/*`, readiness weights, formulas, Move ranking, API contracts. Any library API change that leaks into domain code gets the smallest adapter, isolated in its own commit.

## PR 2 — only if proven necessary

Candidates (open only on demonstrated breakage): tamagui 2.4.6→2.7.7; Clerk adapter shims; Metro/Babel config additions. Do not pre-create.

## Merge gates

Per `verification.md`. Highlights: full CI green (all five jobs), financial parity tests byte-identical and passing, `npm ci` reproducible from committed lockfile, then device gate.

## Device bring-up after PR 1 merges (user actions, Windows)

```powershell
cd C:\Dev\Jahiz
git checkout main ; git pull
npm ci
npm run mobile:start:tunnel
```

Then scan the QR with the iPhone camera → opens in Expo Go (SDK 57). A GitHub merge does not update the phone; Metro must be restarted after every dependency change (`--clear` is already in the start script).

## Dependabot hygiene (after PR 1)

- Close #10 (worklets 0.11.3) — superseded; Expo pins 0.10.1.
- #11 (react-dom 19.2.8) and #12 (@tamagui/config 2.6.2) — superseded/deferred; re-evaluate after migration.
- #19 (Docker node 26-alpine) — out of scope, untouched.

## Master issue body (create when write access is available)

> **Title: SDK 57 migration — master reference**
>
> Docs: `docs/migrations/sdk57/` (README, baseline, compatibility-matrix, backup-restore, migration-plan, verification, decision-log)
> Baseline: `main` = `8988c271` · backup: `backup/pre-sdk57-2026-09-08` · tag: `sdk54-baseline` (pending)
> Route: direct 54→57 · Clerk 3.4.2→3.7.8 (v3 kept) · Tamagui 2.4.6 kept
> PR sequence: PR 0 docs → PR 1 platform → (PR 2 conditional) → device gate → #55
> Gates: see `verification.md`. CI baseline: run 144 green on `8988c271`.
> Status: PLANNED / IN PROGRESS / VERIFIED / BLOCKED per checklist below.
> - [ ] PR 0 merged
> - [ ] Backups (tag + bundle) verified
> - [ ] PR 1 CI green
> - [ ] iPhone Expo Go opens app, auth + persistence verified
> - [ ] No P0/P1 in core funnel → unblock #55
