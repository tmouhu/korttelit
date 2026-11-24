import { lonLatToTM35, type TM35 } from '../core/projection';

/**
 * Place search with the public Nominatim server (OpenStreetMap), following its usage policy
 * (https://operations.osmfoundation.org/policies/nominatim/):
 *  - search only on explicit submit (no search-as-you-type),
 *  - at most one request per second, one at a time,
 *  - results are cached (24 h),
 *  - the browser's Referer identifies the app; attribution is shown in the UI.
 */
export interface Place { title: string; detail: string; lon: number; lat: number; kind: string }

export type GeocodeError = 'search-too-short' | 'search-rate-limited' | 'search-network';
export class GeocodeFailure extends Error { constructor(public code: GeocodeError) { super(code); } }

export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
export const MIN_INTERVAL_MS = 1100;
export const CACHE_TTL_MS = 24 * 3600 * 1000;
const CACHE_KEY = 'osm-korttelit:geocode:v1';
const CACHE_MAX = 50;

interface RawItem {
  lat: string; lon: string; name?: string; display_name?: string; type?: string; addresstype?: string;
  address?: Record<string, string>;
}

/** Turn a Nominatim `jsonv2` result list into compact places (drops unusable items and duplicates). */
export function parseNominatim(json: unknown): Place[] {
  if (!Array.isArray(json)) return [];
  const out: Place[] = [];
  const seen = new Set<string>();
  for (const it of json as RawItem[]) {
    const lat = Number(it.lat), lon = Number(it.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const a = it.address ?? {};
    const street = a.road ? (a.house_number ? `${a.road} ${a.house_number}` : a.road) : '';
    const dispParts = (it.display_name ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const title = it.name || street || dispParts[0] || '';
    if (!title) continue;
    const area = a.suburb || a.neighbourhood || a.city_district || '';
    const town = a.city || a.town || a.village || a.municipality || '';
    let detail = [street && street !== title ? street : '', area !== title ? area : '', town !== title ? town : ''].filter(Boolean).join(', ');
    if (!detail) detail = a.state || a.region || ''; // e.g. a town itself: show its region instead
    const key = `${title}|${detail}|${lat.toFixed(2)}|${lon.toFixed(2)}`; // near-duplicates (≈1 km) are merged
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title, detail, lon, lat, kind: it.addresstype || it.type || '' });
  }
  return out;
}

/** Place → EPSG:3067 position. */
export const placeToTM35 = (p: Place): TM35 => lonLatToTM35({ lon: p.lon, lat: p.lat });

export const normaliseQuery = (q: string): string => q.trim().replace(/\s+/g, ' ');

export interface GeocoderDeps {
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
}

export function createGeocoder(deps: GeocoderDeps = {}) {
  const fetchImpl = deps.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const now = deps.now ?? (() => Date.now());
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const storage = deps.storage === undefined ? (typeof localStorage === 'undefined' ? null : localStorage) : deps.storage;

  let lastStart = -Infinity;
  let queue: Promise<unknown> = Promise.resolve();

  const readCache = (): Record<string, { t: number; places: Place[] }> => {
    try { return JSON.parse(storage?.getItem(CACHE_KEY) ?? '{}') as Record<string, { t: number; places: Place[] }>; } catch { return {}; }
  };
  const writeCache = (c: Record<string, { t: number; places: Place[] }>): void => {
    try {
      const keys = Object.keys(c).sort((a, b) => c[a]!.t - c[b]!.t);
      for (const k of keys.slice(0, Math.max(0, keys.length - CACHE_MAX))) delete c[k];
      storage?.setItem(CACHE_KEY, JSON.stringify(c));
    } catch { /* storage full or unavailable */ }
  };

  async function run(query: string, lang: 'fi' | 'en', signal?: AbortSignal): Promise<Place[]> {
    const q = normaliseQuery(query).slice(0, 120);
    if (q.length < 2) throw new GeocodeFailure('search-too-short');
    const key = `${lang}|${q.toLowerCase()}`;
    const cache = readCache();
    const hit = cache[key];
    if (hit && now() - hit.t < CACHE_TTL_MS) return hit.places;

    const wait = lastStart + MIN_INTERVAL_MS - now();
    if (wait > 0) await sleep(wait);
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    lastStart = now();

    const url = `${NOMINATIM_URL}?${new URLSearchParams({ q, format: 'jsonv2', limit: '6', countrycodes: 'fi', 'accept-language': lang, addressdetails: '1' })}`;
    let res: Response;
    try { res = await fetchImpl(url, { signal, headers: { Accept: 'application/json' } }); }
    catch (e) { if ((e as Error).name === 'AbortError') throw e; throw new GeocodeFailure('search-network'); }
    if (res.status === 429 || res.status === 403) throw new GeocodeFailure('search-rate-limited');
    if (!res.ok) throw new GeocodeFailure('search-network');
    let places: Place[];
    try { places = parseNominatim(await res.json()); } catch { throw new GeocodeFailure('search-network'); }
    const c2 = readCache(); c2[key] = { t: now(), places }; writeCache(c2);
    return places;
  }

  return {
    /** Searches are serialised so that two requests are never in flight and never closer than MIN_INTERVAL_MS. */
    search(query: string, lang: 'fi' | 'en', signal?: AbortSignal): Promise<Place[]> {
      const p = queue.then(() => run(query, lang, signal));
      queue = p.catch(() => undefined);
      return p;
    },
  };
}

export const geocoder = createGeocoder();
