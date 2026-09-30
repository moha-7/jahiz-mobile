# Compatibility matrix — SDK 54 → SDK 57

Evidence read 2026-09-08. "Target" = what PR 1 should land. `npx expo install --fix` is the executor for all Expo-pinned rows; the pins below are what it should resolve to (verify at run time, tilde ranges float on patch).

Primary sources:
- SDK 57 changelog: https://expo.dev/changelog/sdk-57 (released 2026-06-30; RN 0.86; React 19.2; "small, focused release", RN 0.86 has no breaking changes from 0.85)
- SDK 56 changelog: https://expo.dev/changelog/sdk-56 (2026-05-21; RN 0.85; expo-router decoupled from react-navigation + codemod; expo/fetch becomes global fetch; @expo/vector-icons deprecated but still published)
- SDK 55 changelog: https://expo.dev/changelog/sdk-55 (2026-02-25; RN 0.83; Legacy Architecture dropped, `newArchEnabled` removed from app.json; expo-av removed; router `reset`→`resetOnFocus`)
- Expo Go / App Store policy: https://expo.dev/changelog/expo-go-and-app-store-may-2026 (SDK 55/56 Expo Go never reached the App Store; store Expo Go moves to latest SDK)
- SDK 57 pinned versions: `bundledNativeModules.json` @ expo/expo `sdk-57` branch
- npm registry metadata (peerDependencies), read via `npm view` 2026-09-08

| Package | Baseline | Target | Evidence / notes | Risk |
|---|---|---|---|---|
| expo | ~54.0.0 | ~57.0.20 (npm `latest` 57.0.20) | Memory + startup regressions fixed by 57.0.9 / 57.0.17 → take latest patch | Low |
| react-native | 0.81.5 | 0.86.2 | Expo pin; crosses 0.83/0.85/0.86 | Med |
| react / react-dom | 19.1.0 | 19.2.3 | Expo pin; also update ROOT devDeps (19.1.0 there) | Low |
| @types/react | ~19.1.10 | ~19.2.x | `--fix` resolves | Low |
| expo-router | ~6.0.24 | ~57.0.11+ (latest 57.0.19) | Unified versioning; SDK 56 decoupling from react-navigation — **run codemod** `npx expo-codemod sdk-56-expo-router-react-navigation-replace apps/mobile/src` (4 files affected, listed in baseline.md); SDK 55 renamed headless-tabs `reset`→`resetOnFocus` | **High** (navigation is core funnel) |
| @clerk/expo | 3.4.2 | **3.7.8** | 3.4.2 peer `expo >=53 <57` blocks SDK 57. 3.7.0+ = `>=53 <58` (VERIFIED via npm). Staying on v3 avoids the 4.x major (4.0.0 published 2026-07-21). Latest is 4.6.5 (`>=54 <58`) — NOT chosen for this migration | Med |
| react-native-reanimated | ~4.1.1 | 4.5.1 | Expo pin (SDK 57 ships 4.5) | Med |
| react-native-worklets | 0.5.1 | 0.10.1 | Expo pin. **Not 0.11.3** — close Dependabot #10 unmerged | Med |
| react-native-gesture-handler | ~2.28.0 | ~2.32.0 | Expo pin | Low |
| react-native-screens | ~4.16.0 | ~4.26.0 | Expo pin | Low |
| react-native-safe-area-context | ~5.6.0 | ~5.7.0 | Expo pin | Low |
| react-native-svg | 15.12.1 | 15.15.4 | Expo pin; lucide-react-native consumes it | Low |
| @shopify/flash-list | 2.0.2 | **2.0.2 (unchanged)** | SDK 57 pins exactly 2.0.2 | None |
| react-native-web | ~0.21.0 | ~0.21.0 (unchanged) | Expo pin unchanged | None |
| tamagui / @tamagui/config / @tamagui/animations-react-native | 2.4.6 | **keep 2.4.6** | Peer is only `react >=19` (VERIFIED via npm) — satisfied by 19.2.3. JS-only. Escalate to 2.7.7 ONLY if compile/runtime breakage is demonstrated; record in decision-log | Low→Med |
| @expo/vector-icons | ^15.0.3 | keep (^15.0.2 still bundled in SDK 57) | Deprecated in SDK 56 in favor of @react-native-vector-icons/*, but still works; migration is OUT of scope | Low |
| expo-constants/font/haptics/image/linear-gradient/linking/localization/secure-store/splash-screen/status-bar/system-ui/web-browser | various | ~57.0.x each | Unified versioning, `--fix` resolves; bundledNativeModules verified | Low |
| @lingui/core+react | 6.5.0 | keep | Peer `react ^16–^19` (VERIFIED) | None |
| @tanstack/react-query, zustand, zod, react-hook-form, lucide-react-native | pinned | keep | JS-only, no RN/Expo peers | None |
| eslint-config-expo | ~10.0.0 | ~57.0.2 | Unified versioning | Low |
| typescript | ~5.9.2 | what `--fix` selects (SDK 56 notes cite TS 6.0.3) | Verify `mobile:typecheck` gate | Med |
| Node / npm | >=22.19.0 / npm@10.9.8 / CI 22.22.3 | unchanged | No evidence any target requires newer Node | None |

## Behavioral changes to watch (from SDK 55/56 notes, even though code search shows no direct usage)

1. **`expo/fetch` becomes `globalThis.fetch`** (SDK 56). API/auth bearer-token calls go through it. Covered by `test:auth:contracts` + `test:api:integration` at the contract level, but the mobile runtime path needs device smoke-testing. Opt-out escape hatch: `EXPO_PUBLIC_USE_RN_FETCH=1`.
2. **Legacy Architecture removed** (SDK 55). App already runs New Arch (`newArchEnabled: true`); action is only to delete the key from app.json.
3. **Edge-to-edge mandatory on Android 16+** (SDK 55). Android is not the verification target; note only.
4. **app.json schema**: `newArchEnabled` and `edgeToEdgeEnabled` keys removed; we only carry the former.
5. **experiments.reactCompiler / typedRoutes**: verify against SDK 57 schema at migration time (`npx expo-doctor`); adjust only if doctor flags them.

## UNKNOWNs (must stay UNKNOWN until measured)

- Whether Tamagui 2.4.6 compiles/renders correctly under RN 0.86 — decided by CI + device, not assumed.
- Whether Clerk 3.7.8 session/token cache format is byte-compatible with 3.4.2 on-device state — v3 minor line implies yes; verify sign-in restoration on device before trusting stored sessions.
- The exact Expo Go version installed on the user's iPhone (only the error text is reported). Confirm on device before concluding anything about store availability.
