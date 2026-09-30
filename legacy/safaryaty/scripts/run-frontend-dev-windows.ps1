$ErrorActionPreference = "Stop"
Write-Host "Starting Safaryaty frontend fast dev mode..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\.."
if (-not (Test-Path "node_modules")) {
  Write-Host "node_modules not found. Installing once..." -ForegroundColor Yellow
  npm install
}
Write-Host "Open http://127.0.0.1:5173" -ForegroundColor Green
npm run dev
