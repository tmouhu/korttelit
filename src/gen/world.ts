import { CATALOGUE, poiKind } from './catalogue';
import { dist2, PointGrid, pointInPoly, ringArea, SegIndex, segIntersectT, polyLength, type XY } from './geom';
import { buildGraph, isPathy, Router, type Graph } from './graph';
import type { OsmData, Way } from './osm';

export interface Candidate {
  id: number; pos: XY; kind: string; weight: number;
  /** nearest walkable graph node and the straight-line distance to it (m); node = -1 if unreachable */
  node: number; snap: number; forest?: boolean;
  /** corner-type features: grid bearing (deg, clockwise from grid north) the corner points to */
  dir?: number;
}

export interface World {
  graph: Graph;
  router: Router;
  candidates: Candidate[];
  grid: PointGrid<Candidate>;
  /** snap an arbitrary point to the walkable network (barrier-aware) */
  snap(p: XY, radius: number, checkBarriers?: boolean, onlyMain?: boolean): { node: number; dist: number } | null;
  /** id of the largest connected component of the walkable network */
  mainComp: number;
  inBuilding(p: XY): boolean;
  /** connected-component id per graph node (walkable network) and component sizes */
  comp: Int32Array; compSize: number[];
  stats: { nodes: number; candidates: number; byKind: Record<string, number> };
}

export interface WorldOptions { allowForest: boolean; maxRouteCost: number }

const BARRIER_LINES = new Set(['fence', 'wall', 'retaining_wall', 'hedge', 'city_wall']);

const isAreaWay = (w: Way): boolean => w.closed;

/** Grid bearing the corner at b points to (away from the angle's inside). */
function cornerDir(a: XY, b: XY, c: XY): number {
  const la = dist2(a, b) || 1, lc = dist2(c, b) || 1;
  const e = -((a[0] - b[0]) / la + (c[0] - b[0]) / lc), n = -((a[1] - b[1]) / la + (c[1] - b[1]) / lc);
  return ((Math.atan2(e, n) * 180) / Math.PI + 360) % 360;
}

export function buildWorld(osm: OsmData, opts: WorldOptions): World {
  const graph = buildGraph(osm.ways);
  const router = new Router(graph, opts.maxRouteCost);

  // connected components of the walkable network: tiny fragments (courtyards, private bits) are never snap targets
  const comp = new Int32Array(graph.n).fill(-1);
  const compSize: number[] = [];
  for (let s0 = 0; s0 < graph.n; s0++) {
    if (comp[s0]! >= 0) continue;
    const id = compSize.length; let size = 0; const stack = [s0]; comp[s0] = id;
    while (stack.length) { const u = stack.pop()!; size++; for (let e = graph.start[u]!; e < graph.start[u + 1]!; e++) { const v = graph.to[e]!; if (comp[v]! < 0) { comp[v] = id; stack.push(v); } } }
    compSize.push(size);
  }
  const MIN_COMP = 40;

  const barriers = new SegIndex(40);
  const buildings: XY[][] = [];
  const buildingIdx = new SegIndex(40); // for point-in-building queries via bbox lookups
  const buildingGrid = new Map<number, number[]>();
  const restricted: XY[][] = [];
  const water: XY[][] = [];
  const woods: XY[][] = [];
  const parks: XY[][] = [];

  const addRing = (ring: XY[], idx: SegIndex[]): void => { for (let i = 1; i < ring.length; i++) idx.forEach((x) => x.add(ring[i - 1]!, ring[i]!)); };
  const cellOf = (x: number, y: number): number => Math.floor(x / 60) * 100003 + Math.floor(y / 60);

  for (const w of osm.ways) {
    const t = w.tags;
    if (t.building && isAreaWay(w)) {
      buildings.push(w.pts); addRing(w.pts, [barriers]);
      const bi = buildings.length - 1;
      const xs = w.pts.map((p) => p[0]), ys = w.pts.map((p) => p[1]);
      for (let cx = Math.floor(Math.min(...xs) / 60); cx <= Math.floor(Math.max(...xs) / 60); cx++)
        for (let cy = Math.floor(Math.min(...ys) / 60); cy <= Math.floor(Math.max(...ys) / 60); cy++) {
          const k = cx * 100003 + cy; const l = buildingGrid.get(k); if (l) l.push(bi); else buildingGrid.set(k, [bi]);
        }
    } else if (t.barrier && BARRIER_LINES.has(t.barrier)) addRing(w.pts, [barriers]);
    else if (t.natural === 'water' && isAreaWay(w)) { water.push(w.pts); addRing(w.pts, [barriers]); }
    else if (t.waterway === 'river' || t.waterway === 'canal') addRing(w.pts, [barriers]);
    else if ((t.railway === 'rail' || t.railway === 'light_rail') && !t.bridge && !t.tunnel) addRing(w.pts, [barriers]);
    else if (isAreaWay(w) && (t.landuse === 'military' || t.landuse === 'railway' || t.landuse === 'industrial' || t.landuse === 'construction' || t.landuse === 'quarry' || t.landuse === 'basin' || t.access === 'private' || t.access === 'no' || t.leisure === 'stadium' || t.leisure === 'pitch')) {
      if (!t.highway && !t.building) { restricted.push(w.pts); addRing(w.pts, [barriers]); }
    } else if (isAreaWay(w) && (t.natural === 'wood' || t.landuse === 'forest' || t.natural === 'scrub' || t.natural === 'heath' || t.natural === 'wetland')) woods.push(w.pts);
    else if (isAreaWay(w) && (t.leisure === 'park' || t.leisure === 'garden' || t.landuse === 'grass' || t.landuse === 'meadow' || t.landuse === 'recreation_ground' || t.landuse === 'village_green' || t.leisure === 'playground')) parks.push(w.pts);
  }
  void buildingIdx;

  const inBuilding = (p: XY): boolean => {
    for (const bi of buildingGrid.get(cellOf(p[0], p[1])) ?? []) if (pointInPoly(p, buildings[bi]!)) return true;
    return false;
  };
  const inAny = (p: XY, polys: XY[][]): boolean => polys.some((r) => pointInPoly(p, r));

  // ---- node spatial grid for snapping
  const nodeCell = 30;
  const nodeGrid = new Map<number, number[]>();
  for (let i = 0; i < graph.n; i++) {
    if (compSize[comp[i]!]! < MIN_COMP) continue;
    const k = Math.floor(graph.xy[i]![0] / nodeCell) * 100003 + Math.floor(graph.xy[i]![1] / nodeCell);
    const l = nodeGrid.get(k); if (l) l.push(i); else nodeGrid.set(k, [i]);
  }
  const nearNodes = (p: XY, r: number): { node: number; d: number }[] => {
    const out: { node: number; d: number }[] = [];
    const x0 = Math.floor((p[0] - r) / nodeCell), x1 = Math.floor((p[0] + r) / nodeCell), y0 = Math.floor((p[1] - r) / nodeCell), y1 = Math.floor((p[1] + r) / nodeCell);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (const n of nodeGrid.get(x * 100003 + y) ?? []) { const d = dist2(graph.xy[n]!, p); if (d <= r) out.push({ node: n, d }); }
    return out.sort((a, b) => a.d - b.d);
  };

  /** true when segment ab crosses a barrier (ignoring contact within 0.8 m of either end) or passes through a building */
  const blocked = (a: XY, b: XY): boolean => {
    const len = dist2(a, b);
    if (len < 0.8) return false;
    for (const si of barriers.query(a, b)) {
      const [c, d] = barriers.segs[si]!;
      const t = segIntersectT(a, b, c, d);
      if (t !== null && t * len > 0.8 && (1 - t) * len > 0.8) return true;
    }
    return inBuilding([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
  };

  const mainComp = compSize.indexOf(Math.max(0, ...compSize));
  const snap = (p: XY, radius: number, check = true, onlyMain = false): { node: number; dist: number } | null => {
    let tries = 0;
    for (const { node, d } of nearNodes(p, radius)) {
      if (onlyMain && comp[node] !== mainComp) continue;
      if (!check || !blocked(p, graph.xy[node]!)) return { node, dist: d };
      if (++tries >= 8) break;
    }
    return null;
  };

  // ---- candidates
  const candidates: Candidate[] = [];
  const grid = new PointGrid<Candidate>(60);
  const dedup = new PointGrid<Candidate>(10);
  const add = (pos: XY, kind: string, forest: boolean, skipBuildingCheck = false, dir?: number): void => {
    const info = CATALOGUE[kind]!;
    if (info.forest && !opts.allowForest) return;
    if (!skipBuildingCheck && inBuilding(pos)) return;
    if (inAny(pos, restricted) || inAny(pos, water)) return;
    const s = snap(pos, forest ? 70 : 25);
    if (!s) return;
    const near = dedup.within(pos, 6);
    if (near.some((c) => c.weight >= info.weight)) return;
    for (const c of near) { c.weight = -1; } // superseded
    const c: Candidate = { id: candidates.length, pos, kind, weight: info.weight, node: s.node, snap: s.dist, forest, ...(dir !== undefined ? { dir } : {}) };
    candidates.push(c); grid.add(c); dedup.add(c);
  };

  // POIs
  for (const p of osm.pois) { const k = poiKind(p.tags); if (k) add(p.pos, k, false); }

  // path junctions
  for (let i = 0; i < graph.n; i++) {
    if (graph.deg[i]! >= 3 && graph.pathyDeg[i]! >= 1 && compSize[comp[i]!]! >= MIN_COMP) {
      const pos = graph.xy[i]!;
      if (inBuilding(pos)) continue;
      const c: Candidate = { id: candidates.length, pos, kind: 'path_junction', weight: CATALOGUE.path_junction!.weight, node: i, snap: 0 };
      const near = dedup.within(pos, 6);
      if (near.some((x) => x.weight >= c.weight)) continue;
      near.forEach((x) => { x.weight = -1; });
      candidates.push(c); grid.add(c); dedup.add(c);
    }
  }

  // ways: buildings, fences/walls, bridges, steps, park & wood corners
  for (const w of osm.ways) {
    const t = w.tags;
    if (t.building && isAreaWay(w)) {
      const ring = w.pts.slice(0, -1);
      if (Math.abs(ringArea(ring)) < 40 || ring.length < 4) continue;
      const ccw = ringArea(ring) > 0;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[(i + ring.length - 1) % ring.length]!, b = ring[i]!, c = ring[(i + 1) % ring.length]!;
        if (dist2(a, b) < 4 || dist2(b, c) < 4) continue;
        const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
        if ((cross > 0) !== ccw) continue; // concave
        const cos = ((a[0] - b[0]) * (c[0] - b[0]) + (a[1] - b[1]) * (c[1] - b[1])) / (dist2(a, b) * dist2(b, c));
        if (cos > 0.5 || cos < -0.5) continue; // want ~60–120° corners
        add(b, 'building_corner', false, true, cornerDir(a, b, c));
      }
    } else if (t.barrier === 'fence' || t.barrier === 'wall') {
      if (polyLength(w.pts) < 6) continue;
      const kind = t.barrier === 'fence' ? 'fence_corner' : 'wall_corner';
      add(w.pts[0]!, kind, false); add(w.pts[w.pts.length - 1]!, kind, false);
      for (let i = 1; i + 1 < w.pts.length; i++) {
        const a = w.pts[i - 1]!, b = w.pts[i]!, c = w.pts[i + 1]!;
        const l1 = dist2(a, b), l2 = dist2(b, c);
        if (l1 < 4 || l2 < 4) continue;
        const cos = ((a[0] - b[0]) * (c[0] - b[0]) + (a[1] - b[1]) * (c[1] - b[1])) / (l1 * l2);
        if (cos > -0.5 && cos < 0.5) add(b, kind, false, false, cornerDir(a, b, c));
      }
    } else if (t.bridge === 'yes' && t.highway && isPathy(w) && polyLength(w.pts) >= 8) {
      add(w.pts[Math.floor(w.pts.length / 2)]!, 'bridge', false);
    } else if (t.highway === 'steps' && polyLength(w.pts) >= 6) {
      add(w.pts[Math.floor(w.pts.length / 2)]!, 'steps', false);
    } else if (isAreaWay(w) && (parks.includes(w.pts) || woods.includes(w.pts))) {
      const isWood = woods.includes(w.pts);
      const ring = w.pts.slice(0, -1);
      if (Math.abs(ringArea(ring)) < 400) continue;
      const ccw = ringArea(ring) > 0;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[(i + ring.length - 1) % ring.length]!, b = ring[i]!, c = ring[(i + 1) % ring.length]!;
        if (dist2(a, b) < 10 || dist2(b, c) < 10) continue;
        const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
        if ((cross > 0) !== ccw) continue;
        add(b, isWood ? 'wood_corner' : 'park_corner', isWood, false, cornerDir(a, b, c));
      }
    }
  }

  const live = candidates.filter((c) => c.weight > 0);
  // re-index after removing superseded entries
  const kept: Candidate[] = [];
  const finalGrid = new PointGrid<Candidate>(60);
  for (const c of live) { c.id = kept.length; kept.push(c); finalGrid.add(c); }
  const byKind: Record<string, number> = {};
  kept.forEach((c) => { byKind[c.kind] = (byKind[c.kind] ?? 0) + 1; });

  return { graph, router, candidates: kept, grid: finalGrid, snap, inBuilding, comp, compSize, mainComp, stats: { nodes: graph.n, candidates: kept.length, byKind } };
}
