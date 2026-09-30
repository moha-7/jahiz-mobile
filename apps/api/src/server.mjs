import {
  createPostgresPool,
} from './db.mjs';
import {
  createTripRepository,
} from './trip-repository.mjs';
import {
  createJahizRuntimeAuthenticator,
} from './auth-runtime-selector.mjs';
import {
  createJahizIdentityRepository,
} from './identity-repository.mjs';
import {
  buildApiServer,
} from './http-app.mjs';

const pool = createPostgresPool();
const repository =
  createTripRepository(pool);
const identityRepository =
  createJahizIdentityRepository(
    pool,
  );

const authenticateRequest =
  createJahizRuntimeAuthenticator({
    identityRepository,
  });

const app = buildApiServer({
  repository,
  authenticateRequest,
  async readinessCheck() {
    await pool.query('SELECT 1');
  },
  logger:
    process.env.NODE_ENV !== 'test',
});

const host =
  process.env.JAHIZ_API_HOST ??
  '127.0.0.1';

const port =
  Number(
    process.env.JAHIZ_API_PORT ??
      4010,
  );

async function shutdown(signal) {
  app.log.info(
    { signal },
    'Shutting down Jahiz API',
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
