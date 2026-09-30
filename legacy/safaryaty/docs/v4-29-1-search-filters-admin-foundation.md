# Safaryaty v4.29.1 â€” Search, Filters & Admin Foundation

## What changed

- Replaced long route dropdowns with searchable route cards.
- Users can search by airport code, city, country, airport name, or currency.
- Added route region filters: Popular, Gulf, Middle East, Europe, Asia, Africa, Americas, Oceania, All.
- Added Payments filters: All, Monthly, Installments, Trip costs.
- Added Payments search and sorting.
- Added My Trips search and sorting.
- Added Admin seed support from env.
- Added Admin tab for ADMIN users in Advanced mode.

## Admin dev seed

`backend/.env`:

```env
ADMIN_EMAIL="admin@example.local"
ADMIN_PASSWORD="CHANGE_ME_DEV_ONLY"
```

Run:

```powershell
.\scripts\setup-backend-windows.ps1
```

This runs seed and creates the admin if missing.

## Security note

The password is development-only. Change it before deployment.

## Core untouched

- engine.js
- payments.js
- canTravel.js
- installments logic
- backend summary contracts
