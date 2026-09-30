# Test status — Jahiz 0.1.0-alpha.1

Generated from the Sprint 0 build environment.

## Passed

- Workspace structure check.
- Core-finance byte parity: 14 frozen source/type files.
- Mobile TypeScript strict check.
- Mobile Expo ESLint check.
- Workspace dependency tree validation.
- Legacy automated suite: 178/178 tests.
- Legacy stability smoke.
- Legacy Vite production build.
- YAML parse checks for Compose, CI and Dependabot files.

## Environment-blocked

- Clean Prisma client generation and backend TypeScript build could not be repeated in this container because `binaries.prisma.sh` did not resolve (`EAI_AGAIN`). The uploaded baseline had previously passed this build gate, but this artifact does not mark the clean build as newly verified.
- Docker CLI is unavailable in this container, so image build and runtime health checks were not executed here.

## Pending device gate

- Expo native launch on Android/iOS.
- Today dashboard visual QA.
- Arabic layout and device restart RTL behavior.
- Route navigation and touch QA.
