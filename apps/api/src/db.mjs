import pg from 'pg';

const { Pool } = pg;

export function createPostgresPool(config = {}) {
  const {
    host = process.env.POSTGRES_HOST ?? '127.0.0.1',
    port = Number(process.env.POSTGRES_PORT ?? 55433),
    user = process.env.POSTGRES_USER ?? 'jahiz',
    password =
      process.env.POSTGRES_PASSWORD ??
      'jahiz_local_only',
    database =
      process.env.POSTGRES_DB ??
      'jahiz_local',
    max = 8,
  } = config;

  return new Pool({
    host,
    port,
    user,
    password,
    database,
    max,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 3_000,
  });
}
