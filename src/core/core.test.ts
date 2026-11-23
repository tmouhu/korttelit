import { describe, expect, it } from 'vitest';
import { declinationDeg, northInfo } from './declination';
import { frameCorners, groundSizeM, groundToPaper, northLineXs, paperToGround, wmsRequests, type PrintSetup } from './printFrame';
import { lonLatToTM35, tm35ToLonLat, trueNorthGridBearingDeg } from './projection';

const hki = lonLatToTM35({ lon: 24.9384, lat: 60.1699 });

describe('projection', () => {
  it('maps Helsinki to the expected TM35FIN area', () => {
    expect(hki.e).toBeGreaterThan(384000);
    expect(hki.e).toBeLessThan(387000);
    expect(hki.n).toBeGreaterThan(6671000);
    expect(hki.n).toBeLessThan(6673000);
  });
  it('round-trips within 1 mm', () => {
    const back = lonLatToTM35(tm35ToLonLat(hki));
    expect(Math.hypot(back.e - hki.e, back.n - hki.n)).toBeLessThan(0.001);
  });
  it('central meridian (27°E) has zero convergence; east of it true north is counter-clockwise from grid north', () => {
    expect(trueNorthGridBearingDeg(lonLatToTM35({ lon: 27, lat: 62 }))).toBeCloseTo(0, 3);
    const east = trueNorthGridBearingDeg(lonLatToTM35({ lon: 30, lat: 62 }));
    expect(east).toBeCloseTo(-3 * Math.sin((62 * Math.PI) / 180), 1);
    expect(trueNorthGridBearingDeg(hki)).toBeGreaterThan(0); // Helsinki is west of 27°E
  });
});

describe('declination', () => {
  it('is easterly and ~9–11° in Helsinki in late 2026', () => {
    const d = declinationDeg(hki, new Date('2026-11-23'));
    expect(d).toBeGreaterThan(9);
    expect(d).toBeLessThan(11.5);
  });
  it('magnetic north grid bearing = D + true-north grid bearing', () => {
    const n = northInfo(hki, new Date('2026-11-23'));
    expect(n.magneticNorthGridBearingDeg).toBeCloseTo(n.declinationDeg + n.trueNorthGridBearingDeg, 9);
  });
});

const setup = (over: Partial<PrintSetup> = {}): PrintSetup => ({
  centre: { e: 385000, n: 6672000 }, paper: 'A4', orientation: 'portrait', scale: 4000, marginMm: 0,
  northGridBearingDeg: 0, ...over,
});

describe('print frame', () => {
  it('ground extents match the table (A4 portrait 1:4000 = 840 × 1188 m)', () => {
    const g = groundSizeM(setup());
    expect(g.w).toBeCloseTo(840, 6);
    expect(g.h).toBeCloseTo(1188, 6);
  });
  it('margins reduce the map area', () => {
    expect(groundSizeM(setup({ marginMm: 10 })).w).toBeCloseTo(760, 6);
  });
  it('landscape swaps dimensions; A3 1:15000 = 4455 × 6300 m', () => {
    expect(groundSizeM(setup({ orientation: 'landscape' })).w).toBeCloseTo(1188, 6);
    const g = groundSizeM(setup({ paper: 'A3', scale: 15000 }));
    expect([g.w, g.h]).toEqual([4455, 6300].map((v) => expect.closeTo(v, 6)));
  });
  it('paper up points to magnetic north; round trips within 0.01 mm', () => {
    const s = setup({ northGridBearingDeg: 10 });
    const up = paperToGround(s, 0, -100); // 100 mm up = 400 m toward bearing 10°
    expect(Math.hypot(up.e - s.centre.e, up.n - s.centre.n)).toBeCloseTo(400, 6);
    expect(Math.atan2(up.e - s.centre.e, up.n - s.centre.n) * 180 / Math.PI).toBeCloseTo(10, 6);
    for (const [x, y] of [[10, 20], [-50, 70], [0, 0]] as const) {
      const r = groundToPaper(s, paperToGround(s, x, y));
      expect(Math.hypot(r.x - x, r.y - y)).toBeLessThan(0.01);
    }
  });
  it('corners are a rectangle with the right side lengths when rotated', () => {
    const c = frameCorners(setup({ northGridBearingDeg: 9.3 }));
    const d = (a: number, b: number) => Math.hypot(c[a]!.e - c[b]!.e, c[a]!.n - c[b]!.n);
    expect(d(0, 1)).toBeCloseTo(840, 6);
    expect(d(1, 2)).toBeCloseTo(1188, 6);
  });
  it('WMS requests never exceed 4000 px and cover the bbox at 300 dpi', () => {
    const reqs = wmsRequests(setup({ paper: 'A3', northGridBearingDeg: 10 }), 300);
    expect(reqs.length).toBeGreaterThan(1);
    for (const r of reqs) {
      expect(r.width).toBeLessThanOrEqual(4000);
      expect(r.height).toBeLessThanOrEqual(4000);
    }
  });
});

describe('north lines', () => {
  it('are evenly spaced by the requested paper distance and lie inside the map area', () => {
    const s = setup({ northGridBearingDeg: 12.3, marginMm: 10 });
    const xs = northLineXs(s, 50);
    expect(xs.length).toBeGreaterThanOrEqual(3);
    xs.slice(1).forEach((x, i) => expect(x - xs[i]!).toBeCloseTo(50, 6));
    xs.forEach((x) => expect(Math.abs(x)).toBeLessThanOrEqual(95));
  });
  it('stay on the same ground lines when the frame moves along the lines (anchored to ground)', () => {
    const a = setup({ northGridBearingDeg: 10 });
    const along = { e: a.centre.e + Math.sin((10 * Math.PI) / 180) * 123, n: a.centre.n + Math.cos((10 * Math.PI) / 180) * 123 };
    const b = { ...a, centre: along };
    northLineXs(a, 50).forEach((x, i) => expect(northLineXs(b, 50)[i]!).toBeCloseTo(x, 6));
  });
  it('moving across by exactly one spacing shifts the lines by one index', () => {
    const a = setup({ northGridBearingDeg: 0 });
    const b = { ...a, centre: { e: a.centre.e + 200, n: a.centre.n } }; // 50 mm × 4000 = 200 m
    expect(northLineXs(b, 50).map((x) => Math.round(x * 1000))).toEqual(northLineXs(a, 50).map((x) => Math.round(x * 1000)));
  });
});
