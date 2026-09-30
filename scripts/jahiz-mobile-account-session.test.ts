import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveJahizAccountSession,
} from '../apps/mobile/src/features/auth/jahiz-account-session-http.ts';

const providerSession = {
  status:
    'provider-authenticated' as const,
  provider: 'clerk' as const,
  providerSubject:
    'clerk_user_mobile',
  sessionId:
    'clerk_session_mobile',
};

test(
  'mobile composes server owner with local provider subject',
  async () => {
    const result =
      await resolveJahizAccountSession({
        apiUrl:
          'https://api.jahiz.test/',
        providerSession,
        async getAuthorizationHeader() {
          return 'Bearer token';
        },
        async fetchImpl(
          input,
          init,
        ) {
          assert.equal(
            input,
            'https://api.jahiz.test/v1/account/session',
          );

          assert.equal(
            init?.headers
              ?.authorization,
            'Bearer token',
          );

          return {
            ok: true,
            status: 200,
            async json() {
              return {
                data: {
                  status:
                    'authenticated',
                  ownerId:
                    'usr_mobile_server',
                  provider: 'clerk',
                  sessionId:
                    'clerk_session_mobile',
                },
              };
            },
          };
        },
      });

    assert.deepEqual(
      result,
      {
        status: 'resolved',
        identity: {
          ownerId:
            'usr_mobile_server',
          provider: 'clerk',
          providerSubject:
            'clerk_user_mobile',
          sessionId:
            'clerk_session_mobile',
        },
      },
    );
  },
);

test(
  'provider mismatch fails closed',
  async () => {
    const result =
      await resolveJahizAccountSession({
        apiUrl:
          'https://api.jahiz.test',
        providerSession,
        async getAuthorizationHeader() {
          return 'Bearer token';
        },
        async fetchImpl() {
          return {
            ok: true,
            status: 200,
            async json() {
              return {
                data: {
                  status:
                    'authenticated',
                  ownerId: 'usr_1',
                  provider:
                    'development',
                  sessionId: null,
                },
              };
            },
          };
        },
      });

    assert.equal(
      result.status,
      'provider-mismatch',
    );
  },
);

test(
  'session mismatch fails closed',
  async () => {
    const result =
      await resolveJahizAccountSession({
        apiUrl:
          'https://api.jahiz.test',
        providerSession,
        async getAuthorizationHeader() {
          return 'Bearer token';
        },
        async fetchImpl() {
          return {
            ok: true,
            status: 200,
            async json() {
              return {
                data: {
                  status:
                    'authenticated',
                  ownerId: 'usr_1',
                  provider: 'clerk',
                  sessionId:
                    'different-session',
                },
              };
            },
          };
        },
      });

    assert.equal(
      result.status,
      'provider-mismatch',
    );
  },
);

test(
  '401 and network failure never become authenticated state',
  async () => {
    const unauthorized =
      await resolveJahizAccountSession({
        apiUrl:
          'https://api.jahiz.test',
        providerSession,
        async getAuthorizationHeader() {
          return 'Bearer token';
        },
        async fetchImpl() {
          return {
            ok: false,
            status: 401,
            async json() {
              return {};
            },
          };
        },
      });

    assert.equal(
      unauthorized.status,
      'unauthorized',
    );

    const unavailable =
      await resolveJahizAccountSession({
        apiUrl:
          'https://api.jahiz.test',
        providerSession,
        async getAuthorizationHeader() {
          return 'Bearer token';
        },
        async fetchImpl() {
          throw new Error(
            'offline',
          );
        },
      });

    assert.equal(
      unavailable.status,
      'unavailable',
    );
  },
);
