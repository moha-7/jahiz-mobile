# Safaryaty v4.27.4 — Intent-first Flow + OAuth Foundation

## Product changes

- Removed the long onboarding style from the empty state.
- New Trip starts from trip intent, not from a generic template list.
- Wizard Step 1 remains Route & Dates only.
- Demo remains available, but account creation happens after value is shown.

## Auth changes

- Added Google OAuth backend endpoints:
  - `GET /api/auth/providers`
  - `GET /api/auth/google/start`
  - `GET /api/auth/google/callback`
- Added Google auth button in the auth UI.
- Microsoft and Apple are shown as future provider placeholders.
- Pending guest trip is stored in `sessionStorage` before OAuth redirect so the same demo trip can be saved after login.

## Required env for Google

```env
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="http://127.0.0.1:4000/api/auth/google/callback"
OAUTH_SUCCESS_REDIRECT="http://127.0.0.1:5173/?auth=success"
OAUTH_FAILURE_REDIRECT="http://127.0.0.1:5173/?auth=failed"
```

## Important

Without Google credentials, password auth and demo mode still work normally. Google button redirects to a failure URL until credentials are configured.
