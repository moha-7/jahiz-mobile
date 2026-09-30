# Safaryaty Backend — Sprint 2.1

Professional backend foundation for Safaryaty.

## Stack

- Node.js
- Express
- Prisma
- SQLite
- HttpOnly cookie sessions
- RBAC foundation
- User-owned trips
- Draft / Active / Archived trip statuses
- Calculation engine foundation

## Setup

```powershell
cd backend
npm install
copy .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Health check:

```text
http://127.0.0.1:4000/api/health
```

## Core Rules

- Every trip belongs to one `userId`.
- Users can only access their own trips.
- Draft trips are real records with `status = DRAFT`.
- A draft becomes active only through `/api/trips/:id/finish`.
- Due date does not mean paid.
- Mark Paid / Undo Paid are explicit API actions.
- Suggestions do not overwrite user plans automatically.
- Backend enforces Free/Pro trip limits.

## Next Sprint

Sprint 2.2 should connect the current React frontend to these APIs:

1. Register/Login from backend.
2. Replace localStorage user session with `/api/auth/me`.
3. Load trips from `/api/trips`.
4. Save wizard drafts into `/api/trips` with `status=DRAFT`.
5. Finish drafts through `/api/trips/:id/finish`.

## v2.4.3 Note

Added `PaymentMark` table and backend payment occurrence endpoints for generated cashflow rows.

Run:

```powershell
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

## v4.29.49 normalized finance profile

After backing up the database:

```bash
npm run prisma:generate
npm run prisma:validate
npm run prisma:migrate:deploy
npm run db:backfill:finance-profile:dry
npm run db:backfill:finance-profile
npm run build
```

`Trip.notes` remains available during the transition. `TripFinanceProfile` is authoritative when present.
