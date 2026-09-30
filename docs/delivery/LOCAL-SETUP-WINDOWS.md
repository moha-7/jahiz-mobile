# Local setup — Windows

## Requirements

- Git
- Node.js `22.19+`
- Docker Desktop with Compose
- Android Studio or a physical phone for mobile testing

## Start

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\bootstrap-windows.ps1
npm run mobile:start
```

Open the QR code using the supported Expo client or run the Android emulator.

## Legacy validation

```powershell
npm ci --prefix legacy/safaryaty
npm ci --prefix legacy/safaryaty/backend
npm run legacy:test
npm run legacy:backend:build
```

Prisma generation needs access to Prisma's binary distribution host on a clean machine.
