# Safaryaty v4.22 — Trips DB Integration

This sprint connects the frontend trip lifecycle to the backend database while keeping the existing UI/logic intact.

## Added

- Trips, Drafts, and Archived trips are now loaded from `/api/trips` after login.
- New trip wizard creates a backend `DRAFT` trip immediately.
- Closing the wizard saves the draft to the backend and shows `Saved in drafts`.
- Finishing a draft calls the backend and turns it into `ACTIVE`.
- Archive/Restore/Delete now call backend status/delete APIs.
- Duplicate creates a new backend `ACTIVE` trip.
- Active trip edits are debounced and synced back to the backend.
- Backend trip `notes` now supports a larger snapshot payload for this transition sprint.

## Important architecture note

This sprint intentionally stores the full client trip snapshot in `Trip.notes` as a bridge layer. This keeps the current frontend calculation engine safe while moving ownership, sessions, drafts, active trips, and archived trips into the database.

Next sprint should move finance arrays into real backend tables step by step:

1. Incomes
2. Life costs
3. Installments
4. Trip costs
5. Expenses
6. Summary calculation from backend engine

## Run

Backend terminal:

```powershell
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Frontend terminal:

```powershell
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```
