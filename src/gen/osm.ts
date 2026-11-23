import { lonLatToTM35 } from '../core/projection';
import type { XY } from './geom';

export type Tags = Record<string, string>;
export interface Way { pts: XY[]; keys: string[]; tags: Tags; closed: boolean }
export interface Poi { pos: XY; tags: Tags }
export interface OsmData { ways: Way[]; pois: Poi[] }

interface RawEl { type: string; tags?: Tags; lat?: number; lon?: number; geometry?: ({ lat: number; lon: number } | null)[] }

/** Parse Overpass JSON (`out tags geom`) into TM35FIN geometry. Vertex keys let the graph join ways at shared nodes. */
export function parseOverpass(text: string): OsmData {
  const raw = JSON.parse(text) as { elements?: RawEl[] };
  const ways: Way[] = [], pois: Poi[] = [];
  for (const e of raw.elements ?? []) {
    const tags = e.tags ?? {};
    if (e.type === 'node' && e.lat !== undefined && e.lon !== undefined) {
      const p = lonLatToTM35({ lon: e.lon, lat: e.lat });
      pois.push({ pos: [p.e, p.n], tags });
    } else if (e.type === 'way' && e.geometry) {
      const pts: XY[] = [], keys: string[] = [];
      for (const g of e.geometry) {
        if (!g) continue;
        const p = lonLatToTM35({ lon: g.lon, lat: g.lat });
        pts.push([p.e, p.n]); keys.push(`${g.lat}:${g.lon}`);
      }
      if (pts.length < 2) continue;
      ways.push({ pts, keys, tags, closed: keys.length > 3 && keys[0] === keys[keys.length - 1] });
    }
  }
  return { ways, pois };
}
