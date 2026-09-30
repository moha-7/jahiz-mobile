import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  buildApiServer,
} from '../apps/api/src/http-app.mjs';

const repository = {
  async listTrips() {
    return [];
  },
  async getTrip() {
    return null;
  },
  async createTrip() {
    throw new Error(
      'create should not run',
    );
  },
  async updateTrip() {
    throw new Error(
      'update should not run',
    );
  },
  async transitionTripLifecycle() {
    throw new Error(
      'lifecycle should not run',
    );
  },
};

async function authenticateRequest() {
  return null;
}

test(
  'liveness remains independent from dependency readiness',
  async () => {
    const app =
      buildApiServer({
        repository,
        authenticateRequest,
        async readinessCheck() {
          throw new Error(
            'database unavailable',
          );
        },
      });

    const health =
      await app.inject({
        method: 'GET',
        url: '/health',
      });

    const ready =
      await app.inject({
        method: 'GET',
        url: '/ready',
      });

    assert.equal(
      health.statusCode,
      200,
    );
    assert.equal(
      health.json().status,
      'ok',
    );

    assert.equal(
      ready.statusCode,
      503,
    );
    assert.deepEqual(
      ready.json(),
      {
        status: 'not-ready',
        service: 'jahiz-api',
        dependencies: {
          database:
            'unavailable',
        },
        error: {
          code:
            'dependency_unavailable',
          message:
            'A required dependency is unavailable.',
        },
      },
    );

    await app.close();
  },
);

test(
  'readiness returns 200 only after the dependency check succeeds',
  async () => {
    let calls = 0;

    const app =
      buildApiServer({
        repository,
        authenticateRequest,
        async readinessCheck() {
          calls += 1;
        },
      });

    const response =
      await app.inject({
        method: 'GET',
        url: '/ready',
      });

    assert.equal(
      response.statusCode,
      200,
    );
    assert.equal(calls, 1);
    assert.deepEqual(
      response.json(),
      {
        status: 'ready',
        service: 'jahiz-api',
        dependencies: {
          database: 'ready',
        },
      },
    );

    await app.close();
  },
);

test(
  'missing readiness configuration fails closed instead of claiming ready',
  async () => {
    const app =
      buildApiServer({
        repository,
        authenticateRequest,
      });

    const response =
      await app.inject({
        method: 'GET',
        url: '/ready',
      });

    assert.equal(
      response.statusCode,
      503,
    );
    assert.equal(
      response.json().error.code,
      'readiness_not_configured',
    );

    await app.close();
  },
);

test(
  'production server readiness is wired to a real PostgreSQL query',
  () => {
    const source =
      fs.readFileSync(
        new URL(
          '../apps/api/src/server.mjs',
          import.meta.url,
        ),
        'utf8',
      );

    assert.match(
      source,
      /async readinessCheck\(\)/,
    );
    assert.match(
      source,
      /pool\.query\('SELECT 1'\)/,
    );
  },
);
