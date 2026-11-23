import { dist2, PointGrid, rng, segIntersectT, type XY } from './geom';
import type { Candidate, World } from './world';

export interface GenSettings {
  /** target crow-fly length start → controls → finish (m) */
  targetM: number;
  /** accepted relative deviation of the total (0.1 = ±10 %) */
  tolerance: number;
  minLegM: number; maxLegM: number;
  /** max (route cost / crow-fly) per leg */
  maxRatio: number;
  minSepM: number;
  /** fixed number of controls; undefined = derived from target */
  controls?: number;
  seed: number;
  timeBudgetMs: number;
}

export const LEG_DEFAULTS: Record<number, [number, number]> = { 3000: [60, 300], 4000: [80, 400], 7500: [120, 700], 10000: [150, 900], 15000: [200, 1300] };

export function defaultSettings(scale: number, targetM: number, seed = 1): GenSettings {
  const [minLegM, maxLegM] = LEG_DEFAULTS[scale] ?? [80, 400];
  return { targetM, tolerance: 0.1, minLegM, maxLegM, maxRatio: 2.2, minSepM: 40, seed, timeBudgetMs: 4000 };
}

export interface Slot { /** a locked control keeps its position */ locked?: XY }
export interface GenControl { pos: XY; kind: string; candidateId?: number; locked?: boolean; dir?: number }

export interface GenResult {
  controls: GenControl[];
  metrics: { crowFlyM: number; targetM: number; deviation: number; withinTolerance: boolean; routeRatios: number[]; attempts: number; improvements: number; cost: number; seed: number; elapsedMs: number; candidates: number };
}

export interface GenInput {
  world: World;
  start: XY; finish: XY;
  settings: GenSettings;
  inFrame: (p: XY) => boolean;
  /** one entry per control; locked entries are kept as they are. Length fixes the control count. */
  slots?: Slot[];
  onProgress?: (p: { attempts: number; bestDeviation: number }) => void;
  shouldStop?: () => boolean;
  now?: () => number;
}

export class GenError extends Error {}

type Node = Candidate | { id: -1; pos: XY; kind: string; weight: number; node: number; snap: number; locked?: boolean };

export function generateCourse(inp: GenInput): GenResult {
  const { world, start, finish, settings: S, inFrame } = inp;
  const now = inp.now ?? (() => performance.now());
  const t0 = now();
  const rand = rng(S.seed);
  const D = S.targetM;

  const sS = world.snap(start, 150, false, true), sF = world.snap(finish, 150, false, true);
  if (!sS || !sF) throw new GenError('start-or-finish-not-near-network');
  const startNode: Node = { id: -1, pos: start, kind: 'start', weight: 1, node: sS.node, snap: sS.dist };
  const finishNode: Node = { id: -1, pos: finish, kind: 'finish', weight: 1, node: sF.node, snap: sF.dist };

  const mainComp = world.mainComp;

  // number of controls
  const avgLeg = S.minLegM + 0.4 * (S.maxLegM - S.minLegM);
  let n = inp.slots?.length ?? S.controls ?? Math.max(1, Math.round(D / avgLeg) - 1);
  if (!inp.slots && !S.controls) while ((n + 1) * S.maxLegM * 0.85 < D) n++;
  const slots: Slot[] = inp.slots ?? Array.from({ length: n }, () => ({}));
  n = slots.length;

  const pool = world.candidates.filter((c) => inFrame(c.pos) && world.comp[c.node] === mainComp);
  const grid = new PointGrid<Candidate>(80);
  pool.forEach((c) => grid.add(c));

  // locked controls become virtual nodes
  const lockedNode = (p: XY): Node => {
    const s = world.snap(p, 60, false);
    return { id: -1, pos: p, kind: 'locked', weight: 1, node: s ? s.node : -1, snap: s ? s.dist : 0, locked: true };
  };

  // --- routing ---
  const routeCost = (a: Node, b: Node): number => {
    if (a.node < 0 || b.node < 0) return -1; // unknown (locked, off network): do not penalise
    const r = world.router.from(a.node).get(b.node);
    return r === undefined ? Infinity : r + a.snap + b.snap;
  };

  // --- cost of a full sequence ---
  const evaluate = (seq: Node[]): { cost: number; total: number; ratios: number[] } => {
    let cost = 0, total = 0;
    const ratios: number[] = [];
    const legs: [XY, XY][] = [];
    for (let i = 0; i + 1 < seq.length; i++) {
      const a = seq[i]!, b = seq[i + 1]!;
      const d = dist2(a.pos, b.pos);
      total += d; legs.push([a.pos, b.pos]);
      if (d < S.minLegM) cost += 6 + (S.minLegM - d) / 10;
      if (d > S.maxLegM) cost += 6 + (d - S.maxLegM) / 20;
      const rc = routeCost(a, b);
      if (rc >= 0) {
        if (!Number.isFinite(rc)) cost += 1000;
        else { const r = rc / Math.max(d, 1); ratios.push(r); if (r > S.maxRatio) cost += 20 * (r - S.maxRatio); }
      } else ratios.push(NaN);
    }
    cost += (Math.abs(total - D) / D) * 100;
    for (let i = 0; i < legs.length; i++) {
      for (let j = i + 2; j < legs.length; j++) if (segIntersectT(legs[i]![0], legs[i]![1], legs[j]![0], legs[j]![1]) !== null) cost += 8;
      // sharp reversals between consecutive legs
      if (i + 1 < legs.length) {
        const [a, b] = legs[i]!, [, c] = legs[i + 1]!;
        const l1 = dist2(a, b), l2 = dist2(b, c);
        if (l1 > 0 && l2 > 0) { const cos = ((a[0] - b[0]) * (c[0] - b[0]) + (a[1] - b[1]) * (c[1] - b[1])) / (l1 * l2); if (cos > 0.87) cost += 6; }
      }
    }
    for (let i = 1; i + 1 < seq.length; i++) {
      const p = seq[i]!.pos;
      for (let j = 0; j < legs.length; j++) if (j !== i - 1 && j !== i) { // control close to a non-adjacent leg
        const [a, b] = legs[j]!; const l2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 || 1;
        const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l2));
        if (dist2(p, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]) < 25) cost += 4;
      }
      for (let j = 0; j < seq.length; j++) if (j !== i && dist2(p, seq[j]!.pos) < S.minSepM) cost += 30;
      if (seq[i]!.kind === seq[i + 1]?.kind && seq[i]!.kind !== 'locked') cost += 0.8;
      cost -= 0.4 * seq[i]!.weight;
    }
    return { cost, total, ratios };
  };

  const feasible = (from: Node, c: Node): boolean => {
    const rc = routeCost(from, c);
    const d = dist2(from.pos, c.pos);
    return rc < 0 || (Number.isFinite(rc) && rc / Math.max(d, 1) <= S.maxRatio);
  };

  // --- construction of one attempt ---
  const construct = (): Node[] | null => {
    const seq: Node[] = [startNode];
    const used = new Set<number>();
    let sum = 0;
    let prevDir: XY | null = null;
    for (let i = 0; i < n; i++) {
      const slot = slots[i]!;
      let chosen: Node | null = null;
      if (slot.locked) chosen = lockedNode(slot.locked);
      else {
        const cur = seq[seq.length - 1]!;
        const remaining = D - sum, legsLeft = n - i + 1;
        const ideal = Math.min(S.maxLegM, Math.max(S.minLegM, remaining / legsLeft));
        const cands = grid.within(cur.pos, S.maxLegM).filter((c) => !used.has(c.id) && dist2(c.pos, cur.pos) >= S.minLegM && dist2(c.pos, finish) <= legsLeft * S.maxLegM * 0.9 && (i < n - 1 || feasible(finishNode, c)));
        const weights = cands.map((c) => {
          const d = dist2(c.pos, cur.pos);
          let w = Math.exp(-(((d - ideal) / (0.4 * ideal)) ** 2)) * c.weight;
          if (i === n - 1 || (!slots[i + 1]?.locked && i === n - 1)) { const tot = d + dist2(c.pos, finish); w *= Math.exp(-(((tot - remaining) / (0.12 * remaining + 20)) ** 2)); }
          else { const tot = d + dist2(c.pos, finish); w *= Math.exp(-((Math.max(0, tot - remaining) / (0.25 * remaining + 20)) ** 2)); }
          if (prevDir) { const l = Math.hypot(c.pos[0] - cur.pos[0], c.pos[1] - cur.pos[1]) || 1; const cos = ((c.pos[0] - cur.pos[0]) * prevDir[0] + (c.pos[1] - cur.pos[1]) * prevDir[1]) / l; if (cos < -0.6) w *= 0.25; }
          return w;
        });
        for (let tries = 0; tries < 12 && cands.length; tries++) {
          const tot = weights.reduce((a, b) => a + b, 0);
          if (tot <= 1e-9) break;
          let r = rand() * tot, k = 0;
          while (k < weights.length - 1 && r > weights[k]!) { r -= weights[k]!; k++; }
          const c = cands[k]!;
          if (feasible(cur, c)) { chosen = c; break; }
          weights[k] = 0;
        }
      }
      if (!chosen) return null;
      const cur = seq[seq.length - 1]!;
      sum += dist2(cur.pos, chosen.pos);
      prevDir = [chosen.pos[0] - cur.pos[0], chosen.pos[1] - cur.pos[1]];
      const l = Math.hypot(prevDir[0], prevDir[1]) || 1; prevDir = [prevDir[0] / l, prevDir[1] / l];
      if (chosen.id >= 0) used.add(chosen.id);
      seq.push(chosen);
    }
    seq.push(finishNode);
    return seq;
  };

  let best = null as Node[] | null, bestEval = { cost: Infinity, total: 0, ratios: [] as number[] };
  let attempts = 0, improvements = 0;
  const consider = (seq: Node[]): boolean => { const e = evaluate(seq); if (e.cost < bestEval.cost) { best = seq; bestEval = e; improvements++; return true; } return false; };
  const withinTol = (): boolean => best !== null && Math.abs(bestEval.total - D) / D <= S.tolerance;

  const deadline = t0 + S.timeBudgetMs;
  // Phase 1: randomised constructive starts
  while (now() < deadline && attempts < 400 && !inp.shouldStop?.()) {
    attempts++;
    const seq = construct();
    if (seq) consider(seq);
    if (attempts % 10 === 0) inp.onProgress?.({ attempts, bestDeviation: best ? Math.abs(bestEval.total - D) / D : 1 });
    if (best && attempts >= 25 && bestEval.cost < 12) break;
  }
  // Phase 2: local search (replace one free control)
  const freeIdx = slots.map((s, i) => (s.locked ? -1 : i)).filter((i) => i >= 0);
  const bestSeq0 = best as Node[] | null;
  if (bestSeq0 && freeIdx.length) {
    let cur: Node[] = bestSeq0.slice(), curCost = bestEval.cost;
    let iter = 0;
    while (now() < deadline && iter < 3000 && !inp.shouldStop?.()) {
      iter++;
      const k = freeIdx[Math.floor(rand() * freeIdx.length)]! + 1; // position in seq
      const prev = cur[k - 1]!, next = cur[k + 1]!;
      const centre: XY = [(prev.pos[0] + next.pos[0]) / 2, (prev.pos[1] + next.pos[1]) / 2];
      const near = grid.within(centre, Math.max(S.maxLegM, dist2(prev.pos, next.pos) / 2 + S.maxLegM / 2));
      if (!near.length) continue;
      const c = near[Math.floor(rand() * near.length)]!;
      if (cur.some((x, j) => j !== k && x.id === c.id && c.id >= 0)) continue;
      if (!feasible(prev, c) || !feasible(next, c)) continue;
      const trial = cur.slice(); trial[k] = c;
      const e = evaluate(trial);
      if (e.cost < curCost || rand() < 0.02 * Math.exp(-(e.cost - curCost))) {
        cur = trial; curCost = e.cost;
        if (e.cost < bestEval.cost) { best = trial; bestEval = e; improvements++; }
      }
      if (withinTol() && bestEval.cost < 6) break;
    }
  }
  const final = best as Node[] | null;
  if (!final) throw new GenError('no-course-found');
  const controls: GenControl[] = final.slice(1, -1).map((c) => ({ pos: c.pos, kind: c.kind, candidateId: c.id >= 0 ? c.id : undefined, locked: (c as { locked?: boolean }).locked, dir: (c as { dir?: number }).dir }));
  return {
    controls,
    metrics: {
      crowFlyM: bestEval.total, targetM: D, deviation: (bestEval.total - D) / D, withinTolerance: Math.abs(bestEval.total - D) / D <= S.tolerance,
      routeRatios: bestEval.ratios, attempts, improvements, cost: bestEval.cost, seed: S.seed, elapsedMs: now() - t0, candidates: pool.length,
    },
  };
}
