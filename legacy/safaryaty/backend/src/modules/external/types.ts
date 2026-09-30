export type ExternalProviderType = 'fx-rate' | 'country-metadata' | 'cost-profile' | 'flight-estimate';
export type ExternalConfidence = 'low' | 'medium' | 'high';

export type ExternalDataEnvelope<T> = {
  type: ExternalProviderType;
  source: string;
  data: T;
  confidence: ExternalConfidence;
  fetchedAt: string;
  expiresAt?: string | null;
  stale: boolean;
  notes: string[];
};

export function envelope<T>(input: {
  type: ExternalProviderType;
  source: string;
  data: T;
  confidence?: ExternalConfidence;
  expiresAt?: string | null;
  stale?: boolean;
  notes?: string[];
}): ExternalDataEnvelope<T> {
  return {
    type: input.type,
    source: input.source,
    data: input.data,
    confidence: input.confidence || 'medium',
    fetchedAt: new Date().toISOString(),
    expiresAt: input.expiresAt || null,
    stale: !!input.stale,
    notes: input.notes || []
  };
}
