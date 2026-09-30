# Safaryaty v4.26.4 — Demo-first Auth Gate

## Goal

Remove authentication as the first wall. Users can now try the planning experience first, see the result, then create an account to save and continue.

## Changes

- App opens in Demo mode when there is no active backend session.
- Demo mode loads an example trip immediately so the user sees the value first.
- `New Trip` and `Improve Plan` work before authentication.
- Backend sync is skipped for guest/demo users.
- Finishing a demo wizard shows an account gate to save the plan.
- Sign in / Create account are no longer the first screen.
- Account gate appears as a sheet/modal after value is shown.
- Existing backend auth remains active: register, login, logout, profile, avatar, password.
- Guest trips are migrated to backend after successful account creation/sign-in.

## Product flow

1. User opens app.
2. Sees demo result.
3. Clicks `New Trip` or `Improve Plan`.
4. Builds a plan in the wizard.
5. Gets the live result.
6. App asks to create account to save and continue.

## Run Windows

Backend:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\run-backend-windows.ps1
```

Frontend:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\run-frontend-windows.ps1
```
