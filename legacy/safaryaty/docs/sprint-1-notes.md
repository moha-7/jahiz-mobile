# Sprint 1 Notes

## Goal

Stabilize the first-time user experience before adding a real database.

## User flow

1. User opens Safaryaty.
2. User completes local profile/onboarding.
3. If no trips exist, user sees an empty dashboard.
4. User can create first trip or open demo trip.
5. Once trip exists, original Safaryaty dashboard appears.

## Preset rules

- Presets are suggestions only.
- Presets never auto-apply.
- User can apply selected suggestions only.
- Manual values always have priority.

## RBAC foundation

Added local feature flags so the UI can later connect to backend permissions.

```js
featureFlags(user)
```

Current roles/plans:

- role: USER / ADMIN
- plan: FREE / PRO

## Backend impact

Sprint 2 will replace local session persistence with real database-backed auth.
