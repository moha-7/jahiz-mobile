import { env } from '../../config/env.js';
import { envelope } from './types.js';

export type CountryMetadata = {
  code: string;
  name: string;
  currency: string;
  currencies?: string[];
  region?: string;
  subregion?: string;
  flag?: string;
  capital?: string;
  latlng?: [number, number] | number[];
  source?: string;
};

export interface CountryMetadataProvider {
  sourceName: string;
  listCountries(): Promise<CountryMetadata[]>;
  getCountry(code: string): Promise<CountryMetadata | null>;
}

export const localCountries: CountryMetadata[] = [
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', currencies: ['AED'], region: 'Asia', subregion: 'Western Asia', flag: '🇦🇪', capital: 'Abu Dhabi', source: 'local-foundation' },
  { code: 'EG', name: 'Egypt', currency: 'EGP', currencies: ['EGP'], region: 'Africa', subregion: 'Northern Africa', flag: '🇪🇬', capital: 'Cairo', source: 'local-foundation' },
  { code: 'GE', name: 'Georgia', currency: 'GEL', currencies: ['GEL'], region: 'Asia', subregion: 'Western Asia', flag: '🇬🇪', capital: 'Tbilisi', source: 'local-foundation' },
  { code: 'AM', name: 'Armenia', currency: 'AMD', currencies: ['AMD'], region: 'Asia', subregion: 'Western Asia', flag: '🇦🇲', capital: 'Yerevan', source: 'local-foundation' },
  { code: 'AZ', name: 'Azerbaijan', currency: 'AZN', currencies: ['AZN'], region: 'Asia', subregion: 'Western Asia', flag: '🇦🇿', capital: 'Baku', source: 'local-foundation' },
  { code: 'SA', name: 'Saudi Arabia', currency: 'SAR', currencies: ['SAR'], region: 'Asia', subregion: 'Western Asia', flag: '🇸🇦', capital: 'Riyadh', source: 'local-foundation' },
  { code: 'QA', name: 'Qatar', currency: 'QAR', currencies: ['QAR'], region: 'Asia', subregion: 'Western Asia', flag: '🇶🇦', capital: 'Doha', source: 'local-foundation' },
  { code: 'KW', name: 'Kuwait', currency: 'KWD', currencies: ['KWD'], region: 'Asia', subregion: 'Western Asia', flag: '🇰🇼', capital: 'Kuwait City', source: 'local-foundation' },
  { code: 'OM', name: 'Oman', currency: 'OMR', currencies: ['OMR'], region: 'Asia', subregion: 'Western Asia', flag: '🇴🇲', capital: 'Muscat', source: 'local-foundation' },
  { code: 'BH', name: 'Bahrain', currency: 'BHD', currencies: ['BHD'], region: 'Asia', subregion: 'Western Asia', flag: '🇧🇭', capital: 'Manama', source: 'local-foundation' },
  { code: 'JO', name: 'Jordan', currency: 'JOD', currencies: ['JOD'], region: 'Asia', subregion: 'Western Asia', flag: '🇯🇴', capital: 'Amman', source: 'local-foundation' },
  { code: 'TR', name: 'Türkiye', currency: 'TRY', currencies: ['TRY'], region: 'Asia', subregion: 'Western Asia', flag: '🇹🇷', capital: 'Ankara', source: 'local-foundation' },
  { code: 'US', name: 'United States', currency: 'USD', currencies: ['USD'], region: 'Americas', subregion: 'North America', flag: '🇺🇸', capital: 'Washington, D.C.', source: 'local-foundation' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', currencies: ['GBP'], region: 'Europe', subregion: 'Northern Europe', flag: '🇬🇧', capital: 'London', source: 'local-foundation' }
];

function normalizeRows(rows: any[]): CountryMetadata[] {
  return rows.map((row) => {
    const currencies = Object.keys(row?.currencies || {}).map((value) => String(value).toUpperCase()).filter(Boolean);
    const code = String(row?.cca2 || row?.code || '').toUpperCase();
    const latlng = Array.isArray(row?.latlng) ? row.latlng.slice(0, 2).map(Number) : undefined;
    return {
      code,
      name: row?.name?.common || row?.name || code || 'Unknown country',
      currency: currencies[0] || String(row?.currency || 'USD').toUpperCase(),
      currencies: currencies.length ? currencies : [String(row?.currency || 'USD').toUpperCase()],
      region: row?.region || 'Global',
      subregion: row?.subregion || row?.region || 'Global',
      flag: row?.flag || row?.flags?.emoji || '🌍',
      capital: Array.isArray(row?.capital) ? row.capital[0] : row?.capital || undefined,
      latlng,
      source: 'rest-countries'
    } satisfies CountryMetadata;
  }).filter((country) => country.code && country.currency).sort((a, b) => a.name.localeCompare(b.name));
}

export class LocalCountryMetadataProvider implements CountryMetadataProvider {
  sourceName = 'local-country-provider';
  async listCountries() { return localCountries; }
  async getCountry(code: string) { return localCountries.find((country) => country.code === String(code || '').toUpperCase()) || null; }
}

export class RestCountriesMetadataProvider implements CountryMetadataProvider {
  sourceName = 'rest-countries';

  private endpoint(path: string) {
    return `${env.REST_COUNTRIES_BASE_URL.replace(/\/$/, '')}${path}`;
  }

  private headers(): Record<string, string> {
    return env.REST_COUNTRIES_API_KEY
      ? { 'X-API-Key': env.REST_COUNTRIES_API_KEY, Authorization: `Bearer ${env.REST_COUNTRIES_API_KEY}` }
      : {};
  }

  async listCountries(): Promise<CountryMetadata[]> {
    const url = this.endpoint('/all?fields=cca2,name,currencies,region,subregion,flags,flag,capital,latlng');
    const response = await fetch(url, { headers: this.headers(), signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error(`Country provider failed: ${response.status}`);
    const payload = await response.json();
    const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
    const normalized = normalizeRows(rows);
    if (!normalized.length) throw new Error('Country provider returned no usable rows');
    return normalized;
  }

  async getCountry(code: string): Promise<CountryMetadata | null> {
    const normalizedCode = String(code || '').toUpperCase();
    const all = await this.listCountries();
    return all.find((country) => country.code === normalizedCode) || null;
  }
}

export async function getCountryMetadataEnvelope(provider: CountryMetadataProvider = new LocalCountryMetadataProvider()) {
  const countries = await provider.listCountries();
  return envelope({
    type: 'country-metadata',
    source: provider.sourceName,
    data: countries,
    confidence: provider instanceof RestCountriesMetadataProvider ? 'high' : 'medium',
    notes: provider instanceof RestCountriesMetadataProvider
      ? ['Country metadata normalized by the backend provider adapter.']
      : ['Bundled fallback country metadata.']
  });
}
