# Safaryaty — Free Deployment Guide

## Recommended free/dev stack

For a public test link:

- Frontend: Vercel or Netlify static deploy.
- Backend: Render Web Service free instance.
- Database: Supabase Postgres free/Nano or Render Postgres free trial.

## Current blocker

The local development backend currently uses SQLite:

```env
DATABASE_URL="file:./dev.db"
```

SQLite is fine for local development, but it is not the right source of truth for a cloud backend on ephemeral hosting. Before real public deployment with saved users/trips, migrate Prisma to PostgreSQL.

## Minimum production-readiness checklist

1. Move database from SQLite to PostgreSQL.
2. Add production CORS origin:
   - `APP_ORIGIN=https://your-frontend-domain`
3. Configure secure cookies:
   - `NODE_ENV=production`
   - `COOKIE_SAMESITE=none`
   - secure cookie enabled by production mode.
4. Configure Google OAuth callback for deployed backend:
   - `https://your-backend-domain/api/auth/google/callback`
5. Move profile uploads away from local disk if users will upload avatars.
   - Use Supabase Storage, S3-compatible storage, or disable uploads in production v1.
6. Add seed/demo data safely, not shared across real users.
7. Run:
   - `npm run test:all`
   - backend build
   - Prisma migration

## Vercel frontend

Build command:

```bash
npm install && npm run build
```

Output directory:

```bash
dist
```

Environment variable:

```env
VITE_API_BASE=https://your-backend-domain/api
```

## Render backend

Root directory:

```bash
backend
```

Build command:

```bash
npm install && npm run prisma:generate && npm run build
```

Start command:

```bash
npm run start
```

Environment variables:

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://...
APP_ORIGIN=https://your-frontend-domain
SESSION_COOKIE_NAME=safaryaty_session
SESSION_DAYS=30
COOKIE_SAMESITE=none
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://your-backend-domain/api/auth/google/callback
OAUTH_SUCCESS_REDIRECT=https://your-frontend-domain/?auth=success
OAUTH_FAILURE_REDIRECT=https://your-frontend-domain/?auth=failed
```

## Suggested next deployment sprint

`v4.29.0 — Deployment Readiness`

- Add PostgreSQL Prisma schema/migration support.
- Add production env examples.
- Add Render/Vercel docs.
- Add a health endpoint check page.
- Add upload storage decision.
