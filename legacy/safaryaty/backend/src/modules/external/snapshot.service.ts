import { prisma } from '../../lib/prisma.js';
import type { ExternalConfidence, ExternalDataEnvelope, ExternalProviderType } from './types.js';

export type SnapshotIdentity = {
  provider: string;
  resourceType: ExternalProviderType;
  resourceKey: string;
};

export type SnapshotWrite<T> = SnapshotIdentity & {
  data: T;
  sourceAsOf?: Date | null;
  fetchedAt?: Date;
  expiresAt?: Date | null;
  confidence?: ExternalConfidence;
  stale?: boolean;
  version?: string | null;
  lastError?: string | null;
};

export async function readSnapshot<T>(identity: SnapshotIdentity) {
  const row = await prisma.externalDataSnapshot.findUnique({
    where: {
      provider_resourceType_resourceKey: {
        provider: identity.provider,
        resourceType: identity.resourceType,
        resourceKey: identity.resourceKey
      }
    }
  });
  if (!row) return null;
  try {
    return {
      row,
      data: JSON.parse(row.payloadJson) as T,
      fresh: !!row.expiresAt && row.expiresAt.getTime() > Date.now() && !row.stale
    };
  } catch {
    return null;
  }
}

export async function writeSnapshot<T>(input: SnapshotWrite<T>) {
  const fetchedAt = input.fetchedAt || new Date();
  return prisma.externalDataSnapshot.upsert({
    where: {
      provider_resourceType_resourceKey: {
        provider: input.provider,
        resourceType: input.resourceType,
        resourceKey: input.resourceKey
      }
    },
    create: {
      provider: input.provider,
      resourceType: input.resourceType,
      resourceKey: input.resourceKey,
      payloadJson: JSON.stringify(input.data),
      sourceAsOf: input.sourceAsOf || null,
      fetchedAt,
      expiresAt: input.expiresAt || null,
      confidence: input.confidence || 'medium',
      stale: !!input.stale,
      version: input.version || null,
      lastError: input.lastError || null
    },
    update: {
      payloadJson: JSON.stringify(input.data),
      sourceAsOf: input.sourceAsOf || null,
      fetchedAt,
      expiresAt: input.expiresAt || null,
      confidence: input.confidence || 'medium',
      stale: !!input.stale,
      version: input.version || null,
      lastError: input.lastError || null
    }
  });
}

export async function markSnapshotError(identity: SnapshotIdentity, error: unknown) {
  const message = error instanceof Error ? error.message : String(error || 'Unknown provider error');
  await prisma.externalDataSnapshot.updateMany({
    where: identity,
    data: { stale: true, lastError: message.slice(0, 1000) }
  });
}

export function snapshotEnvelope<T>(snapshot: Awaited<ReturnType<typeof readSnapshot<T>>>): ExternalDataEnvelope<T> | null {
  if (!snapshot) return null;
  const { row, data, fresh } = snapshot;
  return {
    type: row.resourceType as ExternalProviderType,
    source: `${row.provider}:snapshot`,
    data,
    confidence: (row.confidence || 'medium') as ExternalConfidence,
    fetchedAt: row.fetchedAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() || null,
    stale: !fresh,
    notes: [
      fresh ? 'Persistent snapshot is fresh.' : 'Serving the last known snapshot while refresh is pending.',
      ...(row.lastError ? [`Last provider error: ${row.lastError}`] : [])
    ]
  };
}
