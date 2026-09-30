import {
  randomUUID,
} from 'node:crypto';

const providerPattern =
  /^[a-z0-9][a-z0-9._-]*$/;

function requireText(
  value,
  field,
  maxLength,
) {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.trim().length > maxLength
  ) {
    throw new Error(
      `Invalid identity ${field}.`,
    );
  }

  return value.trim();
}

function normalizeIdentity({
  provider,
  providerSubject,
}) {
  const normalizedProvider =
    requireText(
      provider,
      'provider',
      80,
    );

  if (
    !providerPattern.test(
      normalizedProvider,
    )
  ) {
    throw new Error(
      'Invalid identity provider.',
    );
  }

  return {
    provider: normalizedProvider,
    providerSubject:
      requireText(
        providerSubject,
        'providerSubject',
        255,
      ),
  };
}

function defaultOwnerIdFactory() {
  return (
    'usr_' +
    randomUUID().replaceAll('-', '')
  );
}

function mapExistingIdentity(row) {
  if (!row) {
    return null;
  }

  if (row.status !== 'active') {
    return {
      status: 'blocked',
      ownerId: null,
      created: false,
    };
  }

  return {
    status: 'active',
    ownerId: row.user_id,
    created: false,
  };
}

export function createJahizIdentityRepository(
  pool,
  {
    ownerIdFactory =
      defaultOwnerIdFactory,
  } = {},
) {
  if (
    !pool ||
    typeof pool.connect !== 'function'
  ) {
    throw new Error(
      'A PostgreSQL pool is required.',
    );
  }

  if (
    typeof ownerIdFactory !==
      'function'
  ) {
    throw new Error(
      'An ownerId factory is required.',
    );
  }

  async function findIdentity(
    client,
    identity,
  ) {
    const result =
      await client.query(
        `
          SELECT
            l.user_id,
            u.status
          FROM jahiz_identity_link l
          INNER JOIN jahiz_user u
            ON u.id = l.user_id
          WHERE l.provider = $1
            AND l.provider_subject = $2
          LIMIT 1
        `,
        [
          identity.provider,
          identity.providerSubject,
        ],
      );

    return result.rows[0] ?? null;
  }

  async function resolveOwnerId(
    input,
  ) {
    const identity =
      normalizeIdentity(input);

    const result =
      await pool.query(
        `
          SELECT
            l.user_id,
            u.status
          FROM jahiz_identity_link l
          INNER JOIN jahiz_user u
            ON u.id = l.user_id
          WHERE l.provider = $1
            AND l.provider_subject = $2
          LIMIT 1
        `,
        [
          identity.provider,
          identity.providerSubject,
        ],
      );

    const existing =
      mapExistingIdentity(
        result.rows[0],
      );

    return existing?.status ===
      'active'
      ? existing.ownerId
      : null;
  }

  async function ensureOwnerForIdentity(
    input,
  ) {
    const identity =
      normalizeIdentity(input);

    const client =
      await pool.connect();

    try {
      await client.query('BEGIN');

      const existing =
        mapExistingIdentity(
          await findIdentity(
            client,
            identity,
          ),
        );

      if (existing) {
        if (
          existing.status === 'active'
        ) {
          await client.query(
            `
              UPDATE jahiz_identity_link
              SET last_seen_at = NOW()
              WHERE provider = $1
                AND provider_subject = $2
            `,
            [
              identity.provider,
              identity.providerSubject,
            ],
          );
        }

        await client.query('COMMIT');
        return existing;
      }

      const ownerId =
        requireText(
          ownerIdFactory(),
          'ownerId',
          160,
        );

      await client.query(
        `
          INSERT INTO jahiz_user (
            id,
            status
          )
          VALUES ($1, 'active')
        `,
        [ownerId],
      );

      const inserted =
        await client.query(
          `
            INSERT INTO jahiz_identity_link (
              provider,
              provider_subject,
              user_id
            )
            VALUES ($1, $2, $3)
            ON CONFLICT (
              provider,
              provider_subject
            )
            DO NOTHING
            RETURNING user_id
          `,
          [
            identity.provider,
            identity.providerSubject,
            ownerId,
          ],
        );

      if (inserted.rowCount === 1) {
        await client.query('COMMIT');

        return {
          status: 'active',
          ownerId,
          created: true,
        };
      }

      await client.query(
        `
          DELETE FROM jahiz_user
          WHERE id = $1
        `,
        [ownerId],
      );

      const raced =
        mapExistingIdentity(
          await findIdentity(
            client,
            identity,
          ),
        );

      if (!raced) {
        throw new Error(
          'Identity race did not converge.',
        );
      }

      await client.query('COMMIT');
      return raced;
    }
    catch (error) {
      try {
        await client.query('ROLLBACK');
      }
      catch {
        // Preserve original failure.
      }

      throw error;
    }
    finally {
      client.release();
    }
  }

  return {
    resolveOwnerId,
    ensureOwnerForIdentity,
  };
}
