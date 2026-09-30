$ErrorActionPreference = "Stop"
Write-Host "Safaryaty Stability Test — Windows" -ForegroundColor Cyan
Set-Location "$PSScriptRoot\.."

Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
npm install

Write-Host "Running core engine/payment/canTravel tests..." -ForegroundColor Yellow
npm run test:core

Write-Host "Running stability smoke test..." -ForegroundColor Yellow
npm run test:stability

Write-Host "Building frontend..." -ForegroundColor Yellow
npm run build

Write-Host "Checking backend TypeScript build..." -ForegroundColor Yellow
Set-Location backend
npm install
npm run prisma:generate
npm run build
Set-Location ..

Write-Host "All stability checks passed." -ForegroundColor Green
