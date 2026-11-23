export type XY = [number, number];

export const dist2 = (a: XY, b: XY): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Proper intersection of segments ab and cd. Returns t along ab (0..1) or null. */
export function segIntersectT(a: XY, b: XY, c: XY, d: XY): number | null {
  const rx = b[0] - a[0], ry = b[1] - a[1], sx = d[0] - c[0], sy = d[1] - c[1];
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-12) return null;
  const qx = c[0] - a[0], qy = c[1] - a[1];
  const t = (qx * sy - qy * sx) / den, u = (qx * ry - qy * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

export function pointInPoly(p: XY, ring: XY[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!, b = ring[j]!;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

export function ringArea(ring: XY[]): number {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) s += ring[j]![0] * ring[i]![1] - ring[i]![0] * ring[j]![1];
  return s / 2; // positive = counter-clockwise
}

export function polyLength(pts: XY[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += dist2(pts[i - 1]!, pts[i]!);
  return l;
}

/** Uniform grid for segments: query by segment, returns candidate segment indices. */
export class SegIndex {
  private cells = new Map<number, number[]>();
  readonly segs: [XY, XY][] = [];
  constructor(private cell = 50) {}
  private key(cx: number, cy: number): number { return cx * 100003 + cy; }
  add(a: XY, b: XY): void {
    const id = this.segs.push([a, b]) - 1;
    const x0 = Math.floor(Math.min(a[0], b[0]) / this.cell), x1 = Math.floor(Math.max(a[0], b[0]) / this.cell);
    const y0 = Math.floor(Math.min(a[1], b[1]) / this.cell), y1 = Math.floor(Math.max(a[1], b[1]) / this.cell);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const k = this.key(x, y); const l = this.cells.get(k); if (l) l.push(id); else this.cells.set(k, [id]);
    }
  }
  query(a: XY, b: XY): Set<number> {
    const out = new Set<number>();
    const x0 = Math.floor(Math.min(a[0], b[0]) / this.cell), x1 = Math.floor(Math.max(a[0], b[0]) / this.cell);
    const y0 = Math.floor(Math.min(a[1], b[1]) / this.cell), y1 = Math.floor(Math.max(a[1], b[1]) / this.cell);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) this.cells.get(this.key(x, y))?.forEach((i) => out.add(i));
    return out;
  }
}

export class PointGrid<T extends { pos: XY }> {
  private cells = new Map<number, T[]>();
  constructor(private cell = 60) {}
  private key(cx: number, cy: number): number { return cx * 100003 + cy; }
  add(item: T): void {
    const k = this.key(Math.floor(item.pos[0] / this.cell), Math.floor(item.pos[1] / this.cell));
    const l = this.cells.get(k); if (l) l.push(item); else this.cells.set(k, [item]);
  }
  within(p: XY, r: number): T[] {
    const out: T[] = [];
    const x0 = Math.floor((p[0] - r) / this.cell), x1 = Math.floor((p[0] + r) / this.cell);
    const y0 = Math.floor((p[1] - r) / this.cell), y1 = Math.floor((p[1] + r) / this.cell);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (const it of this.cells.get(this.key(x, y)) ?? []) if (dist2(it.pos, p) <= r) out.push(it);
    return out;
  }
}

/** mulberry32 seeded PRNG */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
