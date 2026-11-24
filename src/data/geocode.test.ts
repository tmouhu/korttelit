import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createGeocoder, GeocodeFailure, MIN_INTERVAL_MS, normaliseQuery, parseNominatim, placeToTM35 } from './geocode';

const fx = (n: string): unknown => JSON.parse(readFileSync(`test/fixtures/nominatim-${n}.json`, 'utf8'));
const okResponse = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 });
const memStorage = (): Pick<Storage, 'getItem' | 'setItem'> => { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) }; };

describe('parseNominatim (recorded real responses)', () => {
  it('builds compact titles and details', () => {
    const p = parseNominatim(fx('kamppi-helsinki'));
    expect(p[0]).toMatchObject({ title: 'Kamppi', detail: 'Helsinki' });
    expect(p.length).toBe(2);
    const addr = parseNominatim(fx('mannerheimintie-5-helsinki'));
    expect(addr[0]!.title).toBe('Yliopiston Apteekki');
    expect(addr[0]!.detail).toContain('Mannerheimintie 5');
    expect(addr.every((x) => x.detail.includes('Helsinki'))).toBe(true);
  });
  it('converts a place to TM35FIN near Helsinki', () => {
    const t = placeToTM35(parseNominatim(fx('kamppi-helsinki'))[0]!);
    expect(t.e).toBeGreaterThan(384000); expect(t.e).toBeLessThan(387000);
    expect(t.n).toBeGreaterThan(6671000); expect(t.n).toBeLessThan(6674000);
  });
  it('ignores junk', () => {
    expect(parseNominatim({})).toEqual([]);
    expect(parseNominatim([{ lat: 'x', lon: '1' }, { lat: '60', lon: '25', display_name: '' }])).toEqual([]);
  });
});

describe('geocoder policy handling', () => {
  const setup = (responses: (() => Response)[] ) => {
    let t = 1_000_000; const calls: { at: number; url: string }[] = []; let i = 0;
    const g = createGeocoder({
      now: () => t, sleep: async (ms) => { t += ms; }, storage: memStorage(),
      fetchImpl: (async (url: string) => { calls.push({ at: t, url }); return (responses[Math.min(i++, responses.length - 1)]!)(); }) as unknown as typeof fetch,
    });
    return { g, calls, advance: (ms: number) => { t += ms; } };
  };

  it('sends the documented parameters', async () => {
    const { g, calls } = setup([() => okResponse(fx('kamppi-helsinki'))]);
    await g.search('  Kamppi   Helsinki ', 'fi');
    const u = new URL(calls[0]!.url);
    expect(u.origin + u.pathname).toBe('https://nominatim.openstreetmap.org/search');
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ q: 'Kamppi Helsinki', format: 'jsonv2', countrycodes: 'fi', 'accept-language': 'fi', limit: '6' });
  });
  it('never sends two requests closer than the minimum interval, even when called together', async () => {
    const { g, calls } = setup([() => okResponse([]), () => okResponse([]), () => okResponse([])]);
    await Promise.all([g.search('aa', 'fi'), g.search('bb', 'fi'), g.search('cc', 'fi')]);
    expect(calls.length).toBe(3);
    for (let i = 1; i < calls.length; i++) expect(calls[i]!.at - calls[i - 1]!.at).toBeGreaterThanOrEqual(MIN_INTERVAL_MS);
  });
  it('caches results for the same query (case and spacing insensitive) per language', async () => {
    const { g, calls, advance } = setup([() => okResponse(fx('kamppi-helsinki'))]);
    const a = await g.search('Kamppi', 'fi');
    const b = await g.search('  kamppi ', 'fi');
    expect(calls.length).toBe(1);
    expect(b).toEqual(a);
    await g.search('Kamppi', 'en');
    expect(calls.length).toBe(2);
    advance(25 * 3600 * 1000);
    await g.search('Kamppi', 'fi');
    expect(calls.length).toBe(3);
  });
  it('maps errors to codes and does not cache failures', async () => {
    const { g, calls } = setup([() => new Response('', { status: 429 }), () => new Response('', { status: 500 }), () => okResponse([])]);
    await expect(g.search('Kamppi', 'fi')).rejects.toMatchObject({ code: 'search-rate-limited' });
    await expect(g.search('Kamppi', 'fi')).rejects.toMatchObject({ code: 'search-network' });
    await expect(g.search('Kamppi', 'fi')).resolves.toEqual([]);
    expect(calls.length).toBe(3);
    await expect(g.search('a', 'fi')).rejects.toBeInstanceOf(GeocodeFailure);
  });
  it('maps a network failure', async () => {
    const g = createGeocoder({ storage: memStorage(), sleep: async () => undefined, fetchImpl: (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch });
    await expect(g.search('Kamppi', 'fi')).rejects.toMatchObject({ code: 'search-network' });
  });
  it('normalises queries', () => { expect(normaliseQuery('  a \n b  ')).toBe('a b'); });
});
