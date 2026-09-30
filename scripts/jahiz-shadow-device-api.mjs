import fs from 'node:fs/promises';

import {
  createPostgresPool,
} from '../apps/api/src/db.mjs';

import {
  createTripRepository,
} from '../apps/api/src/trip-repository.mjs';

import {
  createDevelopmentBearerAuthenticator,
} from '../apps/api/src/auth.mjs';

import {
  buildApiServer,
} from '../apps/api/src/http-app.mjs';

const migrationPaths = [
  new URL(
    '../infrastructure/postgres/001_jahiz_server_truth.sql',
    import.meta.url,
  ),
  new URL(
    '../infrastructure/postgres/004_jahiz_trip_lifecycle.sql',
    import.meta.url,
  ),
  new URL(
    '../infrastructure/postgres/005_jahiz_trip_tombstone.sql',
    import.meta.url,
  ),
  new URL(
    '../infrastructure/postgres/006_jahiz_trip_mutation_identity.sql',
    import.meta.url,
  ),
];

const pool =
  createPostgresPool();

for (
  const migrationPath
  of migrationPaths
) {
  await pool.query(
    await fs.readFile(
      migrationPath,
      'utf8',
    ),
  );
}

const repository =
  createTripRepository(pool);

const authenticateRequest =
  createDevelopmentBearerAuthenticator({
    enabled: true,
    nodeEnv: 'development',
  });

const app =
  buildApiServer({
    repository,
    authenticateRequest,
    logger: true,
  });

const host =
  process.env.JAHIZ_API_HOST ??
  '0.0.0.0';

const port =
  Number(
    process.env.JAHIZ_API_PORT ??
      4010,
  );

async function shutdown(
  signal,
) {
  app.log.info(
    { signal },
    'Stopping Jahiz device acceptance API',
  );

  await app.close();
  await pool.end();

  process.exit(0);
}

process.once(
  'SIGINT',
  () => {
    void shutdown('SIGINT');
  },
);

process.once(
  'SIGTERM',
  () => {
    void shutdown('SIGTERM');
  },
);

await app.listen({
  host,
  port,
});

console.log(
  `[JAHIZ_DEVICE_API_READY] http://${host}:${port}`,
);
