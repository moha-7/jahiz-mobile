# Jahiz alpha.3 — Profile & Navigation Shell

## Scope

- Fixed app bar above scrollable content.
- Brand, notification control, and user avatar.
- Real profile/settings screen.
- Language moved from Today into Profile.
- Expo Image avatar foundation.
- Haptic feedback for key profile actions.
- Subtle linear gradient on the fixed app bar.

## Architecture

The components remain inside `apps/mobile` because they currently describe app-shell behavior. Reusable primitives can move to `packages/ui` after a second consumer exists.

Server state remains in TanStack Query, temporary UI state in Zustand, form state in React Hook Form, and financial decisions in `packages/core-finance` with backend verification.

## Deferred

- Persisting profile preferences to PostgreSQL.
- Real notification center.
- Avatar upload.
- Authentication/session actions.
- Airport selector and currency selector sheets.
