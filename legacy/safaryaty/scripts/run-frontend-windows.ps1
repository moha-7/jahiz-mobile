$ErrorActionPreference = "Stop"
Write-Host "Starting Safaryaty frontend..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\.."
npm install
Write-Host "Open http://127.0.0.1:5173" -ForegroundColor Green
npm run dev
