# Safaryaty v4.21 — Frontend Auth Integration

## Done

- Frontend now calls backend `/api/auth/me` on app startup.
- Sign in uses `POST /api/auth/login`.
- Create account uses `POST /api/auth/register`.
- Logout uses `POST /api/auth/logout`.
- Profile save uses `PATCH /api/auth/profile`.
- Avatar upload uses `POST /api/auth/avatar`.
- Password change uses `PATCH /api/auth/password`.
- Backend root `/` now returns API info instead of route-not-found.

## Important

Trips are still stored user-scoped locally in this sprint. Sprint 2.3 moves trips/drafts/active/archived to the database.

## How to run

Terminal 1:

```powershell
cd backend
npm run dev
```

Terminal 2:

```powershell
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

Backend health:

```text
http://127.0.0.1:4000/api/health
```
