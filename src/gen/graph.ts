import type { Way } from './osm';
import { dist2, type XY } from './geom';

const PATHY = new Set(['footway', 'path', 'pedestrian', 'steps', 'track', 'cycleway', 'bridleway']);
/** Cost multipliers for walkable highway classes (1 = ideal). Absent classes are not walkable. */
const COST: Record<string, number> = {
  footway: 1, path: 1, pedestrian: 1, cycleway: 1.02, track: 1.05, bridleway: 1.1, steps: 1.4, living_street: 1.02,
  residential: 1.05, service: 1.1, unclassified: 1.05, road: 1.1, tertiary: 1.08, tertiary_link: 1.1,
  secondary: 1.15, secondary_link: 1.2, primary: 1.3, primary_link: 1.3,
};

export function walkCost(w: Way): number | null {
  const hw = w.tags.highway;
  if (!hw) return null;
  const c = COST[hw];
  if (c === undefined) return null;
  const t = w.tags;
  if (t.foot === 'no' || t.access === 'no' || t.access === 'private' || t.indoor === 'yes') return null;
  if (t.foot === 'private') return null;
  if ((t.access === 'customers' || t.access === 'delivery') && t.foot !== 'yes') return null;
  return c;
}

export function isPathy(w: Way): boolean {
  const hw = w.tags.highway;
  return !!hw && PATHY.has(hw) && w.tags.footway !== 'sidewalk' && w.tags.footway !== 'crossing' && w.tags.footway !== 'traffic_island';
}

export interface Graph {
  n: number;
  xy: XY[];
  /** CSR adjacency */
  start: Int32Array; to: Int32Array; cost: Float32Array;
  /** number of incident pathy (non-pavement) edges per node, and total degree */
  pathyDeg: Uint8Array; deg: Uint8Array;
}

export function buildGraph(ways: Way[]): Graph {
  const id = new Map<string, number>();
  const xy: XY[] = [];
  const edges: [number, number, number][] = [];
  const pathyE: [number, number][] = [];
  const node = (k: string, p: XY): number => { let i = id.get(k); if (i === undefined) { i = xy.length; id.set(k, i); xy.push(p); } return i; };
  for (const w of ways) {
    const m = walkCost(w);
    if (m === null) continue;
    const pathy = isPathy(w);
    let prev = -1;
    for (let i = 0; i < w.pts.length; i++) {
      const cur = node(w.keys[i]!, w.pts[i]!);
      if (prev >= 0 && prev !== cur) {
        const c = dist2(xy[prev]!, xy[cur]!) * m;
        edges.push([prev, cur, c]);
        if (pathy) pathyE.push([prev, cur]);
      }
      prev = cur;
    }
  }
  const n = xy.length;
  const deg = new Uint8Array(n), pathyDeg = new Uint8Array(n);
  const count = new Int32Array(n + 1);
  for (const [a, b] of edges) { count[a + 1]!++; count[b + 1]!++; deg[a] = Math.min(255, deg[a]! + 1); deg[b] = Math.min(255, deg[b]! + 1); }
  for (const [a, b] of pathyE) { pathyDeg[a] = Math.min(255, pathyDeg[a]! + 1); pathyDeg[b] = Math.min(255, pathyDeg[b]! + 1); }
  for (let i = 0; i < n; i++) count[i + 1]! += count[i]!;
  const start = Int32Array.from(count);
  const fill = Int32Array.from(count.subarray(0, n));
  const to = new Int32Array(edges.length * 2), cost = new Float32Array(edges.length * 2);
  for (const [a, b, c] of edges) {
    to[fill[a]!] = b; cost[fill[a]!++] = c;
    to[fill[b]!] = a; cost[fill[b]!++] = c;
  }
  return { n, xy, start, to, cost, pathyDeg, deg };
}

/** Bounded Dijkstra; returns map node → cost (cost ≈ walking distance incl. class penalties). */
export class Router {
  private dist: Float64Array;
  private cache = new Map<number, Map<number, number>>();
  constructor(readonly g: Graph, private maxCost: number) { this.dist = new Float64Array(g.n).fill(Infinity); }

  /** Costs from `src` to all nodes within maxCost (cached per source). */
  from(src: number): Map<number, number> {
    const hit = this.cache.get(src);
    if (hit) return hit;
    const { g, dist, maxCost } = this;
    const touched: number[] = [src];
    dist[src] = 0;
    const hk: number[] = [0], hv: number[] = [src];
    const push = (k: number, v: number): void => {
      let i = hk.length; hk.push(k); hv.push(v);
      while (i > 0) { const p = (i - 1) >> 1; if (hk[p]! <= k) break; hk[i] = hk[p]!; hv[i] = hv[p]!; i = p; }
      hk[i] = k; hv[i] = v;
    };
    while (hk.length) {
      const d = hk[0]!, u = hv[0]!;
      const lk = hk.pop()!, lv = hv.pop()!;
      if (hk.length) {
        let i = 0;
        for (;;) {
          let c = 2 * i + 1; if (c >= hk.length) break;
          if (c + 1 < hk.length && hk[c + 1]! < hk[c]!) c++;
          if (hk[c]! >= lk) break;
          hk[i] = hk[c]!; hv[i] = hv[c]!; i = c;
        }
        hk[i] = lk; hv[i] = lv;
      }
      if (d > dist[u]!) continue;
      for (let e = g.start[u]!; e < g.start[u + 1]!; e++) {
        const v = g.to[e]!, nd = d + g.cost[e]!;
        if (nd <= maxCost && nd < dist[v]!) { if (dist[v] === Infinity) touched.push(v); dist[v] = nd; push(nd, v); }
      }
    }
    const out = new Map<number, number>();
    for (const t of touched) { out.set(t, dist[t]!); dist[t] = Infinity; }
    if (this.cache.size > 4000) this.cache.clear();
    this.cache.set(src, out);
    return out;
  }
}
