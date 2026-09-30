# v4.26.3 — Display Currency + Backend Summary Consistency

Built on v4.26.2 FX Auto Rate.

## Goal

Reduce manual currency confusion and make the backend summary return both:

- trip currency values
- display currency values

## Changes

### Frontend

- Added `displayCurrency` to trip payloads.
- Added `Show Results In` selector in Money step.
- Added `Show Results In` selector in Smart Controls.
- KPI cards now use selected display currency:
  - Ready Money
  - Trip Plan Cost
  - Need to Save
  - Paid Already
- Manual rate and Auto Rate remain available.
- Local calculation still exists as fallback while backend summary source-of-truth sprint continues.

### Backend

- Added `displayCurrency` to Prisma `Trip` model.
- Added `displayCurrency` to trip create/update validation.
- Backend `calculateTrip()` now returns:
  - `currency` = trip currency
  - `displayCurrency` = selected UI/display currency
  - `cards` = values in trip currency
  - `displayCards` = values in display currency
  - `details` = values in trip currency
  - `displayDetails` = values in display currency
  - payment rows include `displayAmount` and `displayCurrency`
- Fixed backend `stillNeeded` formula to avoid double-counting installments:

```txt
Need to Save = max(0, Trip Cost - Paid - Available)
```

## Important

Because Prisma schema changed, run migration again.

## Run on Windows

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\run-backend-windows.ps1
```

In another terminal:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\run-frontend-windows.ps1
```
