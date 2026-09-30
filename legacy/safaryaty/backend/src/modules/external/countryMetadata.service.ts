import { env } from '../../config/env.js';
import { envelope, type ExternalDataEnvelope } from './types.js';
import {
  getCountryMetadataEnvelope,
  LocalCountryMetadataProvider,
  RestCountriesMetadataProvider,
  type CountryMetadata
} from './countryMetadata.adapter.js';
import { markSnapshotError, readSnapshot, snapshotEnvelope, writeSnapshot } from './snapshot.service.js';

const identity = {
  provider: 'rest-countries',
  resourceType: 'country-metadata' as const,
  resourceKey: 'all'
};

let refreshPromise: Promise<ExternalDataEnvelope<CountryMetadata[]>> | null = null;

function expiresAt() {
  return new Date(Date.now() + env.COUNTRY_METADATA_TTL_HOURS * 60 * 60 * 1000);
}

async function fetchAndPersistCountries() {
  const provider = new RestCountriesMetadataProvider();
  const result = await getCountryMetadataEnvelope(provider);
  await writeSnapshot({
    ...identity,
    data: result.data,
    fetchedAt: new Date(result.fetchedAt),
    expiresAt: expiresAt(),
    confidence: result.confidence,
    stale: false,
    version: 'country-metadata-v1',
    lastError: null
  });
  return { ...result, expiresAt: expiresAt().toISOString(), stale: false };
}

function refreshWithLock() {
  if (!refreshPromise) {
    refreshPromise = fetchAndPersistCountries().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export async function getCountriesEnvelope(options: { forceRefresh?: boolean; waitForRefresh?: boolean } = {}) {
  const snapshot = await readSnapshot<CountryMetadata[]>(identity);
  const cached = snapshotEnvelope(snapshot);

  if (!options.forceRefresh && snapshot?.fresh && cached) return cached;

  if (!options.forceRefresh && cached) {
    if (options.waitForRefresh) {
      try { return await refreshWithLock(); }
      catch (error) {
        await markSnapshotError(identity, error);
        return { ...cached, stale: true, notes: [...cached.notes, 'Refresh failed; using last known good snapshot.'] };
      }
    }
    void refreshWithLock().catch(async (error) => { await markSnapshotError(identity, error); });
    return cached;
  }

  try {
    return await refreshWithLock();
  } catch (error) {
    await markSnapshotError(identity, error);
    const fallback = await getCountryMetadataEnvelope(new LocalCountryMetadataProvider());
    return envelope({
      type: 'country-metadata',
      source: 'local-country-fallback',
      data: fallback.data,
      confidence: 'medium',
      stale: true,
      expiresAt: null,
      notes: [`Remote country metadata unavailable: ${error instanceof Error ? error.message : 'unknown error'}`, 'Using bundled local fallback.']
    });
  }
}

export async function getCountryEnvelope(code: string) {
  const all = await getCountriesEnvelope();
  const normalized = String(code || '').trim().toUpperCase();
  const country = all.data.find((item) => item.code === normalized) || null;
  return { ...all, data: country };
}

export async function forceCountrySync() {
  return getCountriesEnvelope({ forceRefresh: true, waitForRefresh: true });
}
