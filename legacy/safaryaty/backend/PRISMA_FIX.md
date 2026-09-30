# Prisma Fix for Backend v2.1.1

The first backend package used `latest` for Prisma, so `npm install` pulled Prisma 7. Prisma 7 moved the database URL out of `schema.prisma` into `prisma.config.ts`, which broke the current SQLite setup.

For this sprint we intentionally pin Prisma to `6.15.0` because the backend schema is written for the stable Prisma 6 workflow:

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

## Clean install commands

From `backend/` run:

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item package-lock.json -ErrorAction SilentlyContinue
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Health check:

```text
http://127.0.0.1:4000/api/health
```
