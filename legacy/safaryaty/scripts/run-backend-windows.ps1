$ErrorActionPreference = "Stop"
Write-Host "Starting Safaryaty backend setup..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\..\backend"
if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }
npm install
npm run prisma:generate
npm run prisma:migrate
Write-Host "Starting backend on http://127.0.0.1:4000" -ForegroundColor Green
npm run dev
