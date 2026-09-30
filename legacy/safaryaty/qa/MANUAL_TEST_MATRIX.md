# Safaryaty Manual Test Matrix

Use this before every release.

## 1. Setup

- [ ] Backend starts on 127.0.0.1:4000
- [ ] Frontend starts on 127.0.0.1:5173
- [ ] `/api/health` returns OK
- [ ] Demo opens without login
- [ ] Logout opens auth page

## 2. Core engines

- [ ] `npm run test:core` passes
- [ ] `npm run test:stability` passes
- [ ] `npm run build` passes

## 3. Short Trip

- [ ] Select Short Trip
- [ ] Add destination costs
- [ ] Score appears live
- [ ] To Pay rows appear
- [ ] Mark Paid changes Paid and To Pay
- [ ] Undo returns row to Upcoming

## 4. Study / Long Stay

- [ ] Select Study Trip
- [ ] Add monthly accommodation
- [ ] Add monthly food
- [ ] Add university fees
- [ ] Planned cost multiplies monthly costs by months
- [ ] Monthly Payments / Installments remain visible

## 5. Currency

- [ ] Auto rate updates when currencies change
- [ ] Manual override still works
- [ ] KPI cards use one display currency
- [ ] Equivalent currency appears as secondary small text

## 6. Auth

- [ ] Demo trip finishes
- [ ] Account gate opens
- [ ] Register/login saves the same trip
- [ ] User lands on that trip
- [ ] Logout returns to auth page

## 7. Mobile

- [ ] Next/Back buttons reachable
- [ ] Bottom navigation does not block buttons
- [ ] Payment rows usable
- [ ] Cards do not overflow
