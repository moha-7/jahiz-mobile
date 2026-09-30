import Fastify from 'fastify';
import {
  serverTripCreateRequestSchema,
  serverTripLifecycleFilterSchema,
  serverTripLifecycleMutationRequestSchema,
  serverTripListResponseSchema,
  serverTripUpdateRequestSchema,
} from '@jahiz/api-contracts';

function validationIssues(error) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

export function buildApiServer({
  repository,
  authenticateRequest,
  readinessCheck = null,
  logger = false,
}) {
  if (
    !repository ||
    typeof repository.listTrips !== 'function' ||
    typeof repository.getTrip !== 'function' ||
    typeof repository.createTrip !== 'function' ||
    typeof repository.updateTrip !== 'function' ||
    typeof repository.transitionTripLifecycle !==
      'function'
  ) {
    throw new Error(
      'A valid trip repository is required.',
    );
  }

  if (
    typeof authenticateRequest !==
    'function'
  ) {
    throw new Error(
      'An authentication verifier is required.',
    );
  }

  if (
    readinessCheck !== null &&
    typeof readinessCheck !== 'function'
  ) {
    throw new Error(
      'Readiness check must be a function when provided.',
    );
  }

  const app = Fastify({
    logger,
    bodyLimit: 1_048_576,
  });

  async function requireAuth(
    request,
    reply,
  ) {
    let auth;

    try {
      auth =
        await authenticateRequest(
          request,
        );
    } catch {
      return reply.code(401).send({
        error: {
          code: 'unauthorized',
          message:
            'Authentication failed.',
        },
      });
    }

    if (
      !auth ||
      typeof auth.ownerId !== 'string' ||
      auth.ownerId.length === 0
    ) {
      return reply.code(401).send({
        error: {
          code: 'unauthorized',
          message:
            'Authentication required.',
        },
      });
    }

    request.jahizAuth = {
      ownerId: auth.ownerId,
      provider:
        typeof auth.provider === 'string'
          ? auth.provider
          : null,
      sessionId:
        typeof auth.sessionId === 'string'
          ? auth.sessionId
          : null,
    };
  }

  app.get(
    '/health',
    async () => ({
      status: 'ok',
      service: 'jahiz-api',
    }),
  );

  app.get(
    '/ready',
    async (_request, reply) => {
      if (!readinessCheck) {
        return reply.code(503).send({
          status: 'not-ready',
          service: 'jahiz-api',
          dependencies: {
            database: 'unknown',
          },
          error: {
            code:
              'readiness_not_configured',
            message:
              'Dependency readiness is not configured.',
          },
        });
      }

      try {
        await readinessCheck();

        return reply.code(200).send({
          status: 'ready',
          service: 'jahiz-api',
          dependencies: {
            database: 'ready',
          },
        });
      } catch {
        return reply.code(503).send({
          status: 'not-ready',
          service: 'jahiz-api',
          dependencies: {
            database: 'unavailable',
          },
          error: {
            code:
              'dependency_unavailable',
            message:
              'A required dependency is unavailable.',
          },
        });
      }
    },
  );

  app.get(
    '/v1/trips',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const parsedStatus =
        serverTripLifecycleFilterSchema
          .safeParse(
            request.query?.status,
          );

      if (!parsedStatus.success) {
        return reply.code(400).send({
          error: {
            code:
              'invalid_query',
            message:
              'Trip lifecycle filter is invalid.',
            issues:
              validationIssues(
                parsedStatus.error,
              ),
          },
        });
      }

      const trips =
        await repository.listTrips(
          request.jahizAuth.ownerId,
          parsedStatus.data,
        );

      const response =
        serverTripListResponseSchema.parse({
          data: trips,
        });

      return reply.send(response);
    },
  );

  app.get(
    '/v1/trips/:tripId',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const tripId =
        request.params.tripId;

      const trip =
        await repository.getTrip(
          request.jahizAuth.ownerId,
          tripId,
        );

      if (!trip) {
        return reply.code(404).send({
          error: {
            code: 'trip_not_found',
            message:
              'Trip was not found.',
          },
        });
      }

      return reply.send({
        data: trip,
      });
    },
  );

  app.post(
    '/v1/trips',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const parsed =
        serverTripCreateRequestSchema.safeParse(
          request.body,
        );

      if (!parsed.success) {
        return reply.code(400).send({
          error: {
            code: 'invalid_request',
            message:
              'Trip payload is invalid.',
            issues:
              validationIssues(
                parsed.error,
              ),
          },
        });
      }

      const result =
        await repository.createTrip({
          ownerId:
            request.jahizAuth.ownerId,
          clientMutationId:
            parsed.data.clientMutationId,
          workspace:
            parsed.data.workspace,
        });

      if (result.status === 'conflict') {
        return reply.code(409).send({
          status:
            'conflict',
          trip:
            result.trip,
          error: {
            code: 'trip_id_conflict',
            message:
              'Trip id already exists.',
          },
        });
      }

      return reply
        .code(
          result.idempotentReplay
            ? 200
            : 201,
        )
        .send({
          data: result.trip,
          meta: {
            idempotentReplay:
              result.idempotentReplay,
          },
        });
    },
  );

  app.put(
    '/v1/trips/:tripId',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const parsed =
        serverTripUpdateRequestSchema.safeParse(
          request.body,
        );

      if (!parsed.success) {
        return reply.code(400).send({
          error: {
            code: 'invalid_request',
            message:
              'Trip payload is invalid.',
            issues:
              validationIssues(
                parsed.error,
              ),
          },
        });
      }

      const tripId =
        request.params.tripId;

      if (
        parsed.data.workspace.id !==
        tripId
      ) {
        return reply.code(400).send({
          error: {
            code:
              'trip_id_mismatch',
            message:
              'Route trip id and workspace id must match.',
          },
        });
      }

      const result =
        await repository.updateTrip({
          ownerId:
            request.jahizAuth.ownerId,
          tripId,
          expectedRevision:
            parsed.data.expectedRevision,
          clientMutationId:
            parsed.data.clientMutationId,
          workspace:
            parsed.data.workspace,
        });

      if (
        result.status === 'conflict' &&
        !result.trip
      ) {
        return reply.code(404).send({
          error: {
            code: 'trip_not_found',
            message:
              'Trip was not found.',
          },
        });
      }

      if (
        result.status === 'conflict'
      ) {
        return reply.code(409).send({
          status: 'conflict',
          expectedRevision:
            result.expectedRevision,
          trip: result.trip,
        });
      }

      return reply.send({
        data: result.trip,
        meta: {
          idempotentReplay:
            result.idempotentReplay,
        },
      });
    },
  );

  app.patch(
    '/v1/trips/:tripId/lifecycle',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const parsed =
        serverTripLifecycleMutationRequestSchema
          .safeParse(
            request.body,
          );

      if (!parsed.success) {
        return reply.code(400).send({
          error: {
            code:
              'invalid_request',
            message:
              'Trip lifecycle payload is invalid.',
            issues:
              validationIssues(
                parsed.error,
              ),
          },
        });
      }

      const tripId =
        request.params.tripId;

      const result =
        await repository
          .transitionTripLifecycle({
            ownerId:
              request.jahizAuth.ownerId,
            tripId,
            expectedRevision:
              parsed.data.expectedRevision,
            clientMutationId:
              parsed.data.clientMutationId,
            targetStatus:
              parsed.data.targetStatus,
          });

      if (
        result.status === 'conflict' &&
        !result.trip
      ) {
        return reply.code(404).send({
          error: {
            code:
              'trip_not_found',
            message:
              'Trip was not found.',
          },
        });
      }

      if (
        result.status ===
        'conflict'
      ) {
        return reply.code(409).send({
          status:
            'conflict',
          expectedRevision:
            result.expectedRevision,
          trip:
            result.trip,
        });
      }

      if (
        result.status ===
        'invalid_transition'
      ) {
        return reply.code(409).send({
          status:
            'invalid_transition',
          trip:
            result.trip,
        });
      }

      return reply.code(200).send({
        data:
          result.trip,
        meta: {
          idempotentReplay:
            result.idempotentReplay,
        },
      });
    },
  );

  app.setErrorHandler(
    (error, request, reply) => {
      request.log.error(error);

      return reply.code(500).send({
        error: {
          code: 'internal_error',
          message:
            'Unexpected server error.',
        },
      });
    },
  );
  app.get(
    '/v1/account/session',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      if (
        typeof request.jahizAuth.provider !== 'string' ||
        request.jahizAuth.provider.length === 0
      ) {
        return reply.code(401).send({
          error: {
            code: 'unauthorized',
            message:
              'Authenticated account context is incomplete.',
          },
        });
      }

      return reply.code(200).send({
        data: {
          status: 'authenticated',
          ownerId: request.jahizAuth.ownerId,
          provider: request.jahizAuth.provider,
          sessionId: request.jahizAuth.sessionId,
        },
      });
    },
  );

  return app;
}
