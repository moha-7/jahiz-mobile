$ErrorActionPreference = "Continue"
Set-Location "$PSScriptRoot\.."
Write-Host "Cleaning frontend cache..." -ForegroundColor Yellow
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item package-lock.json -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .vite -ErrorAction SilentlyContinue
Write-Host "Cleaning backend cache..." -ForegroundColor Yellow
Set-Location backend
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item package-lock.json -ErrorAction SilentlyContinue
Remove-Item prisma\dev.db -ErrorAction SilentlyContinue
Write-Host "Done. Run run-backend-windows.ps1 and run-frontend-windows.ps1 again." -ForegroundColor Green
