import { env } from '../../config/env.js';
import { markSnapshotError, readSnapshot, writeSnapshot } from '../external/snapshot.service.js';
import { fetchProviderChain, type FxProviderResult, staticRatesForBase } from './fx.provider.js';

type FxSnapshotPayload = FxProviderResult;
type RateOptions = { forceRefresh?: boolean; waitForRefresh?: boolean };

const refreshPromises = new Map<string, Promise<FxSnapshotPayload>>();

function code(value: string) {
  return String(value || '').trim().toUpperCase().slice(0, 3);
}

function identity(base: string) {
  return { provider: 'fx-resolver', resourceType: 'fx-rate' as const, resourceKey: code(base) };
}

function expiryDate() {
  return new Date(Date.now() + env.FX_RATE_TTL_HOURS * 60 * 60 * 1000);
}

async function fetchAndPersist(baseRaw: string) {
  const base = code(baseRaw);
  const result = await fetchProviderChain(base);
  if (!result) throw new Error(`No FX provider returned rates for ${base}`);
  const fetchedAt = new Date();
  const expiresAt = expiryDate();
  await writeSnapshot({
    ...identity(base),
    data: result,
    sourceAsOf: result.sourceAsOf ? new Date(result.sourceAsOf) : null,
    fetchedAt,
    expiresAt,
    confidence: result.confidence,
    stale: result.source.startsWith('static-emergency-fallback'),
    version: 'fx-resolver-v1',
    lastError: null
  });
  return result;
}

function refreshWithLock(base: string) {
  const key = code(base);
  const existing = refreshPromises.get(key);
  if (existing) return existing;
  const promise = fetchAndPersist(key).finally(() => refreshPromises.delete(key));
  refreshPromises.set(key, promise);
  return promise;
}

function responseFromPayload(payload: FxSnapshotPayload, meta: {
  fetchedAt: Date;
  expiresAt: Date | null;
  stale: boolean;
  snapshot?: boolean;
  lastError?: string | null;
}) {
  return {
    payload,
    source: `${payload.source}${meta.snapshot ? ':snapshot' : ''}`,
    sourceAsOf: payload.sourceAsOf,
    fetchedAt: meta.fetchedAt.toISOString(),
    expiresAt: meta.expiresAt?.toISOString() || null,
    stale: meta.stale,
    confidence: payload.confidence,
    lastError: meta.lastError || null
  };
}

async function resolveRates(baseRaw: string, options: RateOptions = {}) {
  const base = code(baseRaw);
  const snapshot = await readSnapshot<FxSnapshotPayload>(identity(base));

  if (!options.forceRefresh && snapshot?.fresh) {
    return responseFromPayload(snapshot.data, {
      fetchedAt: snapshot.row.fetchedAt,
      expiresAt: snapshot.row.expiresAt,
      stale: false,
      snapshot: true,
      lastError: snapshot.row.lastError
    });
  }

  if (!options.forceRefresh && snapshot) {
    const retryCooldownMs = 15 * 60 * 1000;
    const recentlyAttempted = Date.now() - snapshot.row.fetchedAt.getTime() < retryCooldownMs;
    if (snapshot.row.stale && recentlyAttempted) {
      return responseFromPayload(snapshot.data, {
        fetchedAt: snapshot.row.fetchedAt,
        expiresAt: snapshot.row.expiresAt,
        stale: true,
        snapshot: true,
        lastError: snapshot.row.lastError
      });
    }
    if (options.waitForRefresh) {
      try {
        const fresh = await refreshWithLock(base);
        return responseFromPayload(fresh, { fetchedAt: new Date(), expiresAt: expiryDate(), stale: fresh.confidence === 'low' });
      } catch (error) {
        await markSnapshotError(identity(base), error);
      }
    } else {
      void refreshWithLock(base).catch(async (error) => { await markSnapshotError(identity(base), error); });
    }
    return responseFromPayload(snapshot.data, {
      fetchedAt: snapshot.row.fetchedAt,
      expiresAt: snapshot.row.expiresAt,
      stale: true,
      snapshot: true,
      lastError: snapshot.row.lastError
    });
  }

  try {
    const fresh = await refreshWithLock(base);
    return responseFromPayload(fresh, { fetchedAt: new Date(), expiresAt: expiryDate(), stale: fresh.confidence === 'low' });
  } catch (error) {
    await markSnapshotError(identity(base), error);
    const fallback = staticRatesForBase(base);
    if (!fallback) throw error;
    return responseFromPayload(fallback, { fetchedAt: new Date(), expiresAt: null, stale: true, lastError: error instanceof Error ? error.message : String(error) });
  }
}

export async function getRate(fromRaw: string, toRaw: string, options: RateOptions = {}) {
  const from = code(fromRaw);
  const to = code(toRaw);
  if (from.length !== 3 || to.length !== 3) throw new Error('Currency codes must be 3 letters');
  if (from === to) return {
    from,
    to,
    rate: 1,
    source: 'same-currency',
    sourceAsOf: new Date().toISOString().slice(0, 10),
    fetchedAt: new Date().toISOString(),
    expiresAt: null,
    stale: false,
    confidence: 'high',
    ttlHours: env.FX_RATE_TTL_HOURS,
    direction: `${from}->${to}`,
    formula: 'same currency'
  };

  const resolved = await resolveRates(from, options);
  const rate = Number(resolved.payload.rates[to]);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error(`No rate available for ${from} -> ${to}`);
  return {
    from,
    to,
    rate,
    source: resolved.source,
    sourceAsOf: resolved.sourceAsOf,
    fetchedAt: resolved.fetchedAt,
    expiresAt: resolved.expiresAt,
    stale: resolved.stale,
    confidence: resolved.confidence,
    lastError: resolved.lastError,
    ttlHours: env.FX_RATE_TTL_HOURS,
    direction: `${from}->${to}`,
    formula: `amount_${from} * rate = amount_${to}`
  };
}

export async function forceSyncRate(baseRaw: string) {
  const base = code(baseRaw);
  const result = await resolveRates(base, { forceRefresh: true, waitForRefresh: true });
  return {
    base,
    source: result.source,
    sourceAsOf: result.sourceAsOf,
    fetchedAt: result.fetchedAt,
    expiresAt: result.expiresAt,
    stale: result.stale,
    confidence: result.confidence,
    count: Object.keys(result.payload.rates).length
  };
}
