# Sprint 2.1 — Backend Core Architecture

## Implemented

- Added `/backend` app inside the existing Safaryaty project.
- Express API server.
- Prisma + SQLite schema.
- User-owned data model.
- Auth endpoints.
- HttpOnly cookie sessions.
- RBAC permission foundation.
- Draft/Active/Archived trip status.
- Finance data models: incomes, life costs, installments, trip costs, expenses.
- Mark Paid / Undo Paid API.
- Preset suggestions API that never auto-overwrites user plan.
- Backend calculation summary endpoint.

## Not Connected Yet

The React frontend is still running on local state/localStorage. Sprint 2.2 will connect the UI to this API step by step.

## Why this structure

The backend is separated so the current frontend can stay stable while the system grows into a real product. Later we can deploy frontend and backend separately or merge into a full-stack framework if needed.
