# v4.21.1 — Auth Polish + Connection Handling

## Fixes

- Removed instant profile photo preview from the sign in/sign up hero.
- Profile photo upload now shows only selected filename during registration.
- Photo appears after the account is created and backend avatar upload succeeds.
- Frontend API client now gives a clearer backend connection message instead of raw `Failed to fetch`.
- Backend CORS now accepts both:
  - http://127.0.0.1:5173
  - http://localhost:5173
- Root backend route `/` returns API info; `/api/health` remains the main health check.

## Correct startup

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
