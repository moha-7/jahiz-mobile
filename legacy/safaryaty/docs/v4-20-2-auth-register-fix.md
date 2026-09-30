# Safaryaty v4.20.2 â€” Auth Register Fix

## Fixed

Register API was passing `password` directly into `prisma.user.create()` while the database model only has `passwordHash`.

Now `registerUser()` removes `password` from the Prisma create payload and stores only the hashed password.

## Test

```powershell
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Then in another PowerShell window:

```powershell
$body = @{
  name = "Mohamed"
  email = "mo@test.com"
  password = "CHANGE_ME_DEV_ONLY"
  countryOfResidence = "AE"
  nationality = "EG"
  preferredCurrency = "AED"
  preferredLanguage = "en"
  travelFrequency = "sometimes"
  travelPurpose = "Leisure"
  defaultTravelStyle = "Balanced"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://127.0.0.1:4000/api/auth/register" `
  -Method POST `
  -Body $body `
  -ContentType "application/json" `
  -SessionVariable s

Invoke-RestMethod `
  -Uri "http://127.0.0.1:4000/api/auth/me" `
  -Method GET `
  -WebSession $s
```
