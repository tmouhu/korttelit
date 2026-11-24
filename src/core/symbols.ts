import { type Course, sequence } from './course';
import { groundToPaper, type PrintSetup } from './printFrame';

/**
 * Course overprint symbol dimensions in PAPER millimetres.
 *
 * !! PROVISIONAL — not yet verified against the IOF ISOM 2017-2 / ISSprOM 2019-2 specifications
 * (EN-08 spike: the O-Map Wiki gives no mm values and blocks automated fetching). Values follow common
 * course-planning software defaults. Change them here only; every renderer reads this table.
 */
export interface SymbolSpec {
  lineWidthMm: number;
  controlOuterDiameterMm: number;
  finishOuterDiameterMm: number;
  finishInnerOuterDiameterMm: number;
  startTriangleSideMm: number;
  numberHeightMm: number;
  numberHaloMm: number;
  labelGapMm: number;
}

/** White outline under course lines and around control numbers: this much is visible on each side (a thin line only). */
export const LINE_HALO_MM = 0.15;

const BASE: SymbolSpec = {
  lineWidthMm: 0.35,
  controlOuterDiameterMm: 6.0,
  finishOuterDiameterMm: 7.0,
  finishInnerOuterDiameterMm: 5.0,
  startTriangleSideMm: 7.0,
  numberHeightMm: 4.0,
  numberHaloMm: 2 * LINE_HALO_MM, // stroke width centred on the glyph outline → LINE_HALO_MM visible outside it, same as the line outline
  labelGapMm: 1.2, // distance between the control circle and its number
};

/** Per-scale overrides / enlargement factors (all 1.0 until verified). */
export const SCALE_FACTOR: Record<number, number> = { 3000: 1, 4000: 1, 7500: 1, 10000: 1, 15000: 1 };

export function symbolSpecFor(scale: number): SymbolSpec {
  const f = SCALE_FACTOR[scale] ?? 1;
  const s = { ...BASE };
  (Object.keys(s) as (keyof SymbolSpec)[]).forEach((k) => { if (k !== 'numberHaloMm') s[k] *= f; });
  return s;
}

export const COURSE_COLOUR = '#b3128c';
/** Magnetic north lines: blue, 0.15 mm. */
export const NORTH_LINE_COLOUR = '#1f5fb4';
export const NORTH_LINE_MM = 0.15;

export type Prim =
  | { kind: 'ring'; x: number; y: number; r: number; width: number }          // r = centre-line radius
  | { kind: 'polyline'; pts: [number, number][]; width: number; closed?: boolean }
  | { kind: 'text'; x: number; y: number; text: string; sizeMm: number; haloMm: number };

export interface SceneItem { prim: Prim; ref?: string }

const DIGIT_W = 0.56; // average digit advance as a fraction of the font size (sans-serif)
const CAP = 0.716;    // digit height as a fraction of the font size

export function fontSizeForDigitHeight(hMm: number): number { return hMm / CAP; }
export function textBox(text: string, spec: SymbolSpec): { w: number; h: number } {
  return { w: text.length * DIGIT_W * fontSizeForDigitHeight(spec.numberHeightMm), h: spec.numberHeightMm };
}

const norm = (a: number): number => ((a % 360) + 360) % 360;
const angDiff = (a: number, b: number): number => { const d = Math.abs(norm(a) - norm(b)); return d > 180 ? 360 - d : d; };
/** Paper bearing (deg clockwise from up) of vector (dx right, dy down). */
const bearing = (dx: number, dy: number): number => norm((Math.atan2(dx, -dy) * 180) / Math.PI);

/** Pick the label direction farthest from every leg touching the control (45° steps, preferring up-right). */
export function autoLabelAngle(legBearings: number[]): number {
  const prefer = [45, 135, 315, 225, 0, 90, 270, 180];
  const clearance = (a: number): number => (legBearings.length ? Math.min(...legBearings.map((b) => angDiff(a, b))) : 180);
  const ok = prefer.find((a) => clearance(a) >= 90); // first preferred direction that is clear of all legs
  if (ok !== undefined) return ok;
  return prefer.reduce((best, a) => (clearance(a) > clearance(best) ? a : best), prefer[0]!);
}

/** Build the course drawing in paper mm (origin = map-area centre, x right, y down). */
export function buildCourseScene(course: Course, setup: PrintSetup, spec = symbolSpecFor(setup.scale)): SceneItem[] {
  const seq = sequence(course);
  const P = seq.map((s) => groundToPaper(setup, s.pos));
  const items: SceneItem[] = [];
  const key = (i: number): string => { const r = seq[i]!.ref; return r.kind === 'control' ? r.id : r.kind; };
  const w = spec.lineWidthMm;
  const rCtl = spec.controlOuterDiameterMm / 2;
  const tri = spec.startTriangleSideMm;
  const rTriCirc = tri / Math.sqrt(3);

  const trim = (i: number, toward: number): number => {
    const k = seq[i]!.ref.kind;
    if (k === 'finish') return spec.finishOuterDiameterMm / 2;
    if (k === 'start') {
      // leg leaves from the triangle apex only when it points to the next point (it does for the first leg)
      return rTriCirc;
    }
    void toward;
    return rCtl;
  };

  // legs
  const legBearings: number[][] = P.map(() => []);
  for (let i = 0; i + 1 < P.length; i++) {
    const a = P[i]!, b = P[i + 1]!;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    legBearings[i]!.push(bearing(dx, dy));
    legBearings[i + 1]!.push(bearing(-dx, -dy));
    const ta = trim(i, i + 1), tb = trim(i + 1, i);
    if (d <= ta + tb + 0.2) continue; // too close to draw
    const ux = dx / d, uy = dy / d;
    items.push({ ref: key(i), prim: { kind: 'polyline', width: w, pts: [[a.x + ux * ta, a.y + uy * ta], [b.x - ux * tb, b.y - uy * tb]] } });
  }

  seq.forEach((s, i) => {
    const p = P[i]!;
    if (s.ref.kind === 'start') {
      const next = P[i + 1];
      const ang = next ? bearing(next.x - p.x, next.y - p.y) : 0; // apex direction
      const pts: [number, number][] = [0, 120, 240].map((o) => {
        const a = ((ang + o) * Math.PI) / 180;
        return [p.x + rTriCirc * Math.sin(a), p.y - rTriCirc * Math.cos(a)];
      });
      items.push({ ref: 'start', prim: { kind: 'polyline', pts, width: w, closed: true } });
    } else if (s.ref.kind === 'finish') {
      const ro = spec.finishOuterDiameterMm / 2, ri = spec.finishInnerOuterDiameterMm / 2;
      items.push({ ref: 'finish', prim: { kind: 'ring', x: p.x, y: p.y, r: ro - w / 2, width: w } });
      items.push({ ref: 'finish', prim: { kind: 'ring', x: p.x, y: p.y, r: ri - w / 2, width: w } });
    } else {
      items.push({ ref: s.ref.id, prim: { kind: 'ring', x: p.x, y: p.y, r: rCtl - w / 2, width: w } });
      const text = s.label!;
      const ctl = course.controls.find((c) => s.ref.kind === 'control' && c.id === s.ref.id);
      const ang = ctl?.labelAngleDeg ?? autoLabelAngle(legBearings[i]!);
      const a = (ang * Math.PI) / 180;
      const dx = Math.sin(a), dy = -Math.cos(a);
      const box = textBox(text, spec);
      const off = rCtl + spec.labelGapMm + Math.abs(dx) * box.w / 2 + Math.abs(dy) * box.h / 2;
      items.push({ ref: s.ref.id, prim: { kind: 'text', x: p.x + dx * off, y: p.y + dy * off, text, sizeMm: fontSizeForDigitHeight(spec.numberHeightMm), haloMm: spec.numberHaloMm } });
    }
  });
  return items;
}
