import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import { lonLatToTM35 } from '../core/projection';
import { defaultSettings, generateCourse, type GenResult } from './generator';
import { dist2, type XY } from './geom';
import { parseOverpass } from './osm';
import { buildWorld, type World } from './world';

const xy = (lon: number, lat: number): XY => { const p = lonLatToTM35({ lon, lat }); return [p.e, p.n]; };
const lo = xy(24.9262, 60.1625), hi = xy(24.9488, 60.1725); // inside the fixture, with margin
const inFrame = (p: XY): boolean => p[0] > lo[0] && p[0] < hi[0] && p[1] > lo[1] && p[1] < hi[1];

let world: World;
beforeAll(() => {
  const osm = parseOverpass(gunzipSync(readFileSync('test/fixtures/helsinki-kamppi.json.gz')).toString());
  const t = performance.now();
  world = buildWorld(osm, { allowForest: false, maxRouteCost: 1000 });
  console.log('world', Math.round(performance.now() - t), 'ms', JSON.stringify(world.stats));
});

const run = (seed: number, target: number, scale = 4000): GenResult => {
  const s = defaultSettings(scale, target, seed);
  return generateCourse({ world, start: xy(24.9325, 60.1665), finish: xy(24.9425, 60.1685), settings: { ...s, timeBudgetMs: 6000 }, inFrame });
};

describe('OSM world (real Helsinki data)', () => {
  it('builds a network and a rich candidate set', () => {
    expect(world.stats.nodes).toBeGreaterThan(5000);
    expect(world.stats.candidates).toBeGreaterThan(300);
    expect(Object.keys(world.stats.byKind).length).toBeGreaterThanOrEqual(5);
  });
  it('no candidate lies inside a building unless it is a building corner', () => {
    const bad = world.candidates.filter((c) => c.kind !== 'building_corner' && world.inBuilding(c.pos));
    expect(bad.length).toBe(0);
  });
});

describe('course generator', () => {
  for (const target of [1500, 2500, 3500]) {
    it(`target ${target} m: within ±10 %, reachable, inside frame, separated`, { timeout: 30000 }, () => {
      const r = run(7, target);
      process.stderr.write(target + ' ' + JSON.stringify({ ...r.metrics, routeRatios: r.metrics.routeRatios.map((x) => +x.toFixed(2)) }) + ' ' + r.controls.map((c) => c.kind).join(',') + '\n');
      expect(r.metrics.withinTolerance).toBe(true);
      expect(r.controls.length).toBeGreaterThanOrEqual(3);
      r.metrics.routeRatios.forEach((x) => { expect(Number.isFinite(x)).toBe(true); expect(x).toBeLessThanOrEqual(2.2 + 1e-9); });
      r.controls.forEach((c) => expect(inFrame(c.pos)).toBe(true));
      for (let i = 0; i < r.controls.length; i++) for (let j = i + 1; j < r.controls.length; j++) expect(dist2(r.controls[i]!.pos, r.controls[j]!.pos)).toBeGreaterThan(40);
    });
  }
  it('is reproducible for the same seed and differs across seeds', { timeout: 60000 }, () => {
    const a = run(3, 2000), b = run(3, 2000), c = run(4, 2000);
    expect(JSON.stringify(a.controls.map((x) => x.pos))).toBe(JSON.stringify(b.controls.map((x) => x.pos)));
    expect(JSON.stringify(a.controls.map((x) => x.pos))).not.toBe(JSON.stringify(c.controls.map((x) => x.pos)));
  });
  it('keeps locked controls', { timeout: 60000 }, () => {
    const base = run(5, 2500);
    const keep = base.controls[1]!.pos;
    const s = defaultSettings(4000, 2500, 9);
    const r = generateCourse({ world, start: xy(24.9325, 60.1665), finish: xy(24.9425, 60.1685), settings: { ...s, timeBudgetMs: 6000 }, inFrame, slots: base.controls.map((c, i) => (i === 1 ? { locked: keep } : {})) });
    expect(r.controls[1]!.pos).toEqual(keep);
    expect(r.controls.length).toBe(base.controls.length);
  });
});
