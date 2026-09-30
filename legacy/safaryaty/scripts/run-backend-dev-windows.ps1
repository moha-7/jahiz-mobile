$ErrorActionPreference = "Stop"
Write-Host "Starting Safaryaty backend fast dev mode..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\..\backend"
if (-not (Test-Path "node_modules")) {
  Write-Host "node_modules not found. Running setup first..." -ForegroundColor Yellow
  npm install
  npm run prisma:generate
}
Write-Host "Backend on http://127.0.0.1:4000" -ForegroundColor Green
npm run dev
