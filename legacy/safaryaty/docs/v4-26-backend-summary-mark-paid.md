# Safaryaty v4.26 — Backend Summary + Mark Paid API

## Goal

This sprint moves one more part of the financial logic into the backend without breaking the current UI bridge.

## Added

### Backend

- Added `PaymentMark` model to track generated payment occurrence status.
- Added backend endpoints:
  - `PATCH /api/trips/:tripId/payments/:paymentKey/mark-paid`
  - `PATCH /api/trips/:tripId/payments/:paymentKey/undo-paid`
- Enhanced `GET /api/trips/:tripId/summary` to return:
  - cards
  - details
  - upcoming payments
  - paid payments
- Enhanced cashflow engine to calculate installment occurrences and apply `PaymentMark` records.

### Frontend

- Added API helpers:
  - `api.markPaymentPaid(tripId, paymentKey)`
  - `api.undoPaymentPaid(tripId, paymentKey)`
- Payment Tracker now attempts backend Mark Paid / Undo for saved DB trips, then updates the local UI bridge.

## Important

The snapshot bridge is still active. This means the app keeps the current stable UI while progressively moving finance logic to real DB tables.

## Required after update

Because Prisma schema changed, run:

```powershell
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

## Manual API tests

After login and after creating/syncing a trip:

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:4000/api/trips/<TRIP_ID>/summary" `
  -Method GET `
  -WebSession $s
```

Mark a generated installment occurrence as paid:

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:4000/api/trips/<TRIP_ID>/payments/inst-<INSTALLMENT_ID>-0/mark-paid" `
  -Method PATCH `
  -WebSession $s
```

Undo:

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:4000/api/trips/<TRIP_ID>/payments/inst-<INSTALLMENT_ID>-0/undo-paid" `
  -Method PATCH `
  -WebSession $s
```
