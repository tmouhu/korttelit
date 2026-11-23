import { t } from '../i18n';
import { type BBox } from '../core/printFrame';
import { tm35ToLonLat } from '../core/projection';

/** Public Overpass mirrors, tried in order (rotated on failure). Reliability varies a lot — see plan/spikes/EN-06. */
export const OVERPASS_MIRRORS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const POI_NODES = [
  'historic~"^(memorial|monument|wayside_cross|wayside_shrine|statue|boundary_stone|fort|ruins)$"',
  'tourism~"^(artwork|viewpoint|picnic_site|information)$"',
  'amenity~"^(bench|fountain|drinking_water|shelter|toilets|clock)$"',
  'man_made~"^(water_well|flagpole|tower|cross|obelisk)$"',
  'natural~"^(stone|rock)$"',
  'natural=tree][denotation~"^(landmark|natural_monument|avenue)$"',
  'leisure~"^(picnic_table|firepit)$"',
  'highway=bus_stop',
];

/** Overpass QL for everything the generator needs inside a WGS84 box (south, west, north, east). */
export function buildQuery(s: number, w: number, n: number, e: number, lean = false): string {
  const b = `(${s.toFixed(6)},${w.toFixed(6)},${n.toFixed(6)},${e.toFixed(6)})`;
  // lean mode (big frames): skip pavements/crossings; roads remain walkable in the graph
  const hw = lean
    ? `way["highway"]["highway"!~"^(corridor|elevator|platform|bus_guideway|proposed|construction|motorway|motorway_link|trunk_link|raceway|services|rest_area|busway)$"]["footway"!~"^(sidewalk|crossing)$"]${b};`
    : `way["highway"]["highway"!~"^(corridor|elevator|platform|bus_guideway|proposed|construction|raceway|services|rest_area|busway)$"]${b};`;
  return `[out:json][timeout:90];(
${hw}
way["building"]${b};
way["barrier"~"^(fence|wall|retaining_wall|hedge|city_wall|guard_rail)$"]${b};
way["natural"~"^(water|wood|scrub|grassland|heath|wetland)$"]${b};
way["waterway"~"^(river|stream|canal|ditch)$"]${b};
way["railway"~"^(rail|light_rail|subway|tram|abandoned|disused)$"]${b};
way["landuse"~"^(forest|grass|meadow|recreation_ground|village_green|cemetery|military|railway|industrial|construction|allotments|basin|quarry|farmland)$"]${b};
way["leisure"~"^(park|garden|playground|pitch|sports_centre|stadium)$"]${b};
way["access"~"^(private|no)$"]${b};
${POI_NODES.map((q) => `node[${q}]${b};`).join('\n')}
);out tags geom;`;
}

export function bboxToWgs(b: BBox, padM = 50): { s: number; w: number; n: number; e: number } {
  const corners = [
    tm35ToLonLat({ e: b.minE - padM, n: b.minN - padM }), tm35ToLonLat({ e: b.maxE + padM, n: b.minN - padM }),
    tm35ToLonLat({ e: b.minE - padM, n: b.maxN + padM }), tm35ToLonLat({ e: b.maxE + padM, n: b.maxN + padM }),
  ];
  return { s: Math.min(...corners.map((c) => c.lat)), n: Math.max(...corners.map((c) => c.lat)), w: Math.min(...corners.map((c) => c.lon)), e: Math.max(...corners.map((c) => c.lon)) };
}

// ---------- tiny IndexedDB cache (best effort) ----------
const DB = 'osm-korttelit', STORE = 'overpass';
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function cacheGet(key: string): Promise<{ t: number; text: string } | undefined> {
  try { const db = await idb(); return await new Promise((res) => { const q = db.transaction(STORE).objectStore(STORE).get(key); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); }); } catch { return undefined; }
}
async function cachePut(key: string, value: { t: number; text: string }): Promise<void> {
  try { const db = await idb(); db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key); } catch { /* ignore */ }
}

const CACHE_TTL_MS = 7 * 24 * 3600 * 1000;

export interface FetchOptions { mirrors?: string[]; timeoutMs?: number; onStatus?: (m: string) => void; signal?: AbortSignal; fetchImpl?: typeof fetch }

/** Fetch OSM data for a TM35FIN bbox as raw Overpass JSON text. Tries mirrors with timeout; caches successful results. */
export async function fetchOsm(b: BBox, opts: FetchOptions = {}): Promise<string> {
  const w = bboxToWgs(b);
  const lean = (b.maxE - b.minE) * (b.maxN - b.minN) > 4e6;
  const q = buildQuery(w.s, w.w, w.n, w.e, lean);
  const key = `v2:${lean ? 'lean:' : ''}${[w.s, w.w, w.n, w.e].map((v) => v.toFixed(4)).join(',')}`;
  const hit = await cacheGet(key);
  if (hit && Date.now() - hit.t < CACHE_TTL_MS) { opts.onStatus?.(t('status.osmCache')); return hit.text; }
  const mirrors = opts.mirrors ?? OVERPASS_MIRRORS;
  const f = opts.fetchImpl ?? fetch;
  let lastErr = 'no-mirrors';
  for (let round = 0; round < 2; round++) {
    for (const url of mirrors) {
      if (opts.signal?.aborted) throw new Error('aborted');
      opts.onStatus?.(t('status.osmLoading', { host: new URL(url).host }));
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 25000);
      opts.signal?.addEventListener('abort', () => ctl.abort(), { once: true });
      try {
        const r = await f(url, { method: 'POST', body: new URLSearchParams({ data: q }), signal: ctl.signal });
        if (!r.ok) { lastErr = `${new URL(url).host}: HTTP ${r.status}`; continue; }
        const text = await r.text();
        if (!text.trimStart().startsWith('{')) { lastErr = `${new URL(url).host}: bad response`; continue; }
        const parsed = JSON.parse(text) as { remark?: string; elements?: unknown[] };
        if (parsed.remark && /error|timed out|out of memory/i.test(parsed.remark) && !(parsed.elements?.length)) { lastErr = `${new URL(url).host}: ${parsed.remark}`; continue; }
        void cachePut(key, { t: Date.now(), text });
        return text;
      } catch (e) {
        if (opts.signal?.aborted) throw new Error('aborted');
        lastErr = `${new URL(url).host}: ${(e as Error).name === 'AbortError' ? 'timeout' : (e as Error).message}`;
      } finally { clearTimeout(timer); }
    }
    await new Promise((r) => setTimeout(r, 1500 * (round + 1)));
  }
  throw new Error(`osm-unavailable: ${lastErr}`);
}
