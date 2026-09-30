# Jahiz alpha.4 — Route Foundation

## Scope

- Today dashboard visual refinement from the approved Figma direction.
- Compact bilingual profile shell.
- Persisted English/Arabic preference.
- Plan tab entry state.
- Interactive Create Trip Route screen.
- Airport/city search modal using FlashList.
- Local bilingual airport directory for offline-friendly development.
- Origin/destination swap and same-airport validation.
- Shared route API contracts and Node test gate.

## Architecture

```text
Screen
→ feature component
→ Zustand route draft
→ shared Zod contract
→ backend route module (alpha.6)
→ Prisma / PostgreSQL (alpha.6)
```

The mobile draft is temporary UI state. The backend remains authoritative when persistence is introduced.

## Deferred

- Remote airport provider.
- Network/offline detection.
- Route persistence endpoint.
- Dates and travelers.
- Production analytics.
