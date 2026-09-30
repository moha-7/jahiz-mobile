$ErrorActionPreference = "Stop"
Write-Host "Safaryaty backend one-time setup..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\..\backend"
if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }
npm install
npm run prisma:generate
npm run prisma:migrate
npm run seed
Write-Host "Backend setup complete. Use scripts\run-backend-dev-windows.ps1 for fast daily start." -ForegroundColor Green
