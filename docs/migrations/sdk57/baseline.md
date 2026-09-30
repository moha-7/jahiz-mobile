# Baseline snapshot — pre-migration (SDK 54)

Frozen from `main` @ `8988c2718762b4e147afe1a799319a9a3cc9924b`, read 2026-09-08 via GitHub API.
Manifest SHAs: root `package.json` blob `9c6c7dc9`, `apps/mobile/package.json` blob `bc106b87`, `apps/mobile/app.json` blob `5c1d2268`, `.github/workflows/ci.yml` blob `bdf9aaaa`.

## Workspace

- Root: `jahiz@0.1.0-alpha.6`, npm workspaces `apps/*` + `packages/*`, `packageManager: npm@10.9.8`, engines `node >=22.19.0`.
- CI Node: `22.22.3` (env `NODE_VERSION` in ci.yml).
- Apps: `apps/api`, `apps/mobile`. Legacy: `legacy/safaryaty` (reference only).

## apps/mobile declared dependencies (VERIFIED FROM CODE)

```
@clerk/expo                      3.4.2
@expo/vector-icons               ^15.0.3
@lingui/core / @lingui/react     6.5.0
@shopify/flash-list              2.0.2
@tamagui/animations-react-native ^2.4.6
@tamagui/config                  2.4.6
@tanstack/react-query            5.101.2
expo                             ~54.0.0
expo-constants                   ~18.0.13
expo-font                        ~14.0.12
expo-haptics                     ~15.0.8
expo-image                       ~3.0.11
expo-linear-gradient             ~15.0.8
expo-linking                     ~8.0.12
expo-localization                ~17.0.9
expo-router                      ~6.0.24
expo-secure-store                ~15.0.8
expo-splash-screen               ~31.0.13
expo-status-bar                  ~3.0.9
expo-system-ui                   ~6.0.9
expo-web-browser                 ~15.0.11
lucide-react-native              ^1.28.0
react / react-dom                19.1.0
react-hook-form                  7.81.0
react-native                     0.81.5
react-native-gesture-handler     ~2.28.0
react-native-reanimated          ~4.1.1
react-native-safe-area-context   ~5.6.0
react-native-screens             ~4.16.0
react-native-svg                 15.12.1
react-native-web                 ~0.21.0
react-native-worklets            0.5.1
tamagui                          2.4.6
zod                              4.4.3
zustand                          5.0.14
--- dev ---
@types/react                     ~19.1.10
eslint                           ^9.35.0
eslint-config-expo               ~10.0.0
typescript                       ~5.9.2
```

Root devDependencies: `react` / `react-dom` `19.1.0` (must move in lockstep with mobile).

## app.json facts relevant to migration (VERIFIED FROM CODE)

- `newArchEnabled: true` (already on New Architecture; the key is **removed from the schema** in SDK 55+)
- Plugins: expo-router, expo-localization, expo-secure-store, expo-splash-screen (with options), expo-font, expo-web-browser, @clerk/expo
- Experiments: `typedRoutes: true`, `reactCompiler: true`
- No `notification` field, no `edgeToEdgeEnabled` key (both fine for SDK 55+ schema changes)

## Code usage facts (VERIFIED FROM CODE, GitHub code search 2026-09-08)

- `@react-navigation/*` imports: exactly 4 files —
  `apps/mobile/src/components/jz-focus-highlight.tsx`, `screen.tsx`, `jz-collapsible-screen.tsx`, `jz-premium-tab-bar.tsx`
  → affected by SDK 56 expo-router/react-navigation decoupling; codemod exists.
- `expo-file-system`, `ExpoRequest`/`ExpoResponse`, `expo-av`, `expo-blur`: **zero usages** → those SDK 55/56 breaking changes do not apply.

## CI at baseline

- Workflow `.github/workflows/ci.yml`, jobs: quality (static gate incl. mobile typecheck/lint), postgres-integration, security (npm audit fail-closed with bounded retry), legacy, docker.
- Last main run: run number 144, conclusion **success**, head `8988c27`.

## Rollback pointer

Return to `8988c2718762b4e147afe1a799319a9a3cc9924b` (main or `backup/pre-sdk57-2026-09-08`). See `backup-restore.md` — a Git rollback does not restore device-local data.
