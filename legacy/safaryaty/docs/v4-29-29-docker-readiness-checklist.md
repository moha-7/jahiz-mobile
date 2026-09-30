# Docker Readiness Checklist

## Services later

- frontend
- backend API
- postgres
- worker
- optional redis/cache

## Worker jobs later

- refresh FX rates
- refresh country metadata
- refresh airport metadata
- refresh cost profiles
- pre-cache flight estimates

## Before Docker

- move SQLite to Postgres
- define production env vars
- replace local uploads with storage provider
- test CORS/session cookies in production mode
- add health checks for backend and worker
