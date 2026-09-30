# QA Gate — 0.1.0-alpha.1

- [x] Workspace installation completed and lockfile generated.
- [x] `npm run test`.
- [x] `npm run mobile:lint`.
- [x] `npm ci --prefix legacy/safaryaty`.
- [x] `npm ci --prefix legacy/safaryaty/backend`.
- [x] Legacy 178/178 tests, stability smoke and web production build.
- [ ] Clean Prisma client generation — blocked by Prisma CDN DNS in this container.
- [ ] Backend clean build — depends on generated Prisma client.
- [ ] Docker image build — Docker CLI unavailable in this container.
- [ ] PostgreSQL container health check — Docker CLI unavailable in this container.
- [ ] Today screen opens on a physical/emulated device.
- [ ] Create Trip route opens from Today on a physical/emulated device.
