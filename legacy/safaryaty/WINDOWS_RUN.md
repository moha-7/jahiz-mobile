# Safaryaty v4.28.0 â€” Windows Run

## Backend terminal

```powershell
cd "C:\Users\Developer\Projects\safaryaty"
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\run-backend-windows.ps1
```

## Frontend terminal

```powershell
cd "C:\Users\Developer\Projects\safaryaty"
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\run-frontend-windows.ps1
```

## Full stability test

```powershell
cd "C:\Users\Developer\Projects\safaryaty"
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\test-windows.ps1
```

## Frontend-only quick test

```powershell
npm install
npm run test:core
npm run test:stability
npm run build
```
