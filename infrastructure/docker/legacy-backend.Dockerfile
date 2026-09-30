FROM node:22-alpine AS dependencies
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

FROM dependencies AS build
WORKDIR /app
COPY shared ./shared
COPY backend ./backend
WORKDIR /app/backend
RUN npm run prisma:generate \
  && npm run prisma:postgres:generate \
  && npm run build \
  && test -f dist/server.js

FROM node:22-alpine AS runtime
ENV NODE_ENV=staging
WORKDIR /app
RUN addgroup -S jahiz && adduser -S jahiz -G jahiz
COPY --from=build --chown=jahiz:jahiz /app/shared ./shared
COPY --from=build --chown=jahiz:jahiz /app/backend/package.json ./backend/package.json
COPY --from=build --chown=jahiz:jahiz /app/backend/node_modules ./backend/node_modules
COPY --from=build --chown=jahiz:jahiz /app/backend/dist ./backend/dist
COPY --from=build --chown=jahiz:jahiz /app/backend/src/generated ./backend/src/generated
COPY --from=build --chown=jahiz:jahiz /app/backend/scripts/run-built-server.mjs ./backend/scripts/run-built-server.mjs
WORKDIR /app/backend
USER jahiz
EXPOSE 4001
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4001)+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "scripts/run-built-server.mjs"]
