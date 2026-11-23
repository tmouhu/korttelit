import type { TM35 } from './projection';
import { deg2rad } from './projection';

export type PaperSize = 'A4' | 'A3';
export type Orientation = 'portrait' | 'landscape';
export const SCALES = [3000, 4000, 7500, 10000, 15000] as const;
export type MapScale = (typeof SCALES)[number];

export const PAPER_MM: Record<PaperSize, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A3: { w: 297, h: 420 },
};

export interface PrintSetup {
  centre: TM35;
  paper: PaperSize;
  orientation: Orientation;
  scale: number;
  marginMm: number;
  /** Grid bearing of magnetic north (deg, clockwise from grid north); map is rotated so it points up. */
  northGridBearingDeg: number;
}

export function sheetMm(s: Pick<PrintSetup, 'paper' | 'orientation'>): { w: number; h: number } {
  const p = PAPER_MM[s.paper];
  return s.orientation === 'portrait' ? { w: p.w, h: p.h } : { w: p.h, h: p.w };
}

/** Map area (inside margins) in paper millimetres. */
export function mapAreaMm(s: PrintSetup): { w: number; h: number } {
  const p = sheetMm(s);
  return { w: p.w - 2 * s.marginMm, h: p.h - 2 * s.marginMm };
}

/** Ground size (metres) of the map area. */
export function groundSizeM(s: PrintSetup): { w: number; h: number } {
  const a = mapAreaMm(s);
  return { w: (a.w * s.scale) / 1000, h: (a.h * s.scale) / 1000 };
}

/** Unit vectors (E,N) of paper "right" and "up" on the ground. */
function axes(s: PrintSetup): { right: [number, number]; up: [number, number] } {
  const m = deg2rad(s.northGridBearingDeg);
  return { up: [Math.sin(m), Math.cos(m)], right: [Math.cos(m), -Math.sin(m)] };
}

/** Paper mm (origin = centre of map area, x right, y down) → ground TM35FIN. */
export function paperToGround(s: PrintSetup, x: number, y: number): TM35 {
  const { right, up } = axes(s);
  const u = (x * s.scale) / 1000;
  const v = (-y * s.scale) / 1000;
  return { e: s.centre.e + u * right[0] + v * up[0], n: s.centre.n + u * right[1] + v * up[1] };
}

export function groundToPaper(s: PrintSetup, p: TM35): { x: number; y: number } {
  const { right, up } = axes(s);
  const de = p.e - s.centre.e;
  const dn = p.n - s.centre.n;
  return {
    x: ((de * right[0] + dn * right[1]) * 1000) / s.scale,
    y: (-(de * up[0] + dn * up[1]) * 1000) / s.scale,
  };
}

/** Corners of the map area on the ground: top-left, top-right, bottom-right, bottom-left. */
export function frameCorners(s: PrintSetup): TM35[] {
  const a = mapAreaMm(s);
  const hw = a.w / 2;
  const hh = a.h / 2;
  return [paperToGround(s, -hw, -hh), paperToGround(s, hw, -hh), paperToGround(s, hw, hh), paperToGround(s, -hw, hh)];
}

export interface BBox { minE: number; minN: number; maxE: number; maxN: number }

export function frameBBox(s: PrintSetup): BBox {
  const c = frameCorners(s);
  return {
    minE: Math.min(...c.map((p) => p.e)),
    maxE: Math.max(...c.map((p) => p.e)),
    minN: Math.min(...c.map((p) => p.n)),
    maxN: Math.max(...c.map((p) => p.n)),
  };
}

export const MAPANT_MAX_PX = 4000;

/** Split the frame's bounding box into WMS requests ≤ maxPx per side at the given dpi (rotated image is cropped later). */
export function wmsRequests(
  s: PrintSetup,
  dpi: number,
  maxPx = MAPANT_MAX_PX,
): { bbox: BBox; width: number; height: number }[] {
  const b = frameBBox(s);
  const metresPerPx = (s.scale / 1000) * (25.4 / dpi);
  const totalW = Math.ceil((b.maxE - b.minE) / metresPerPx);
  const totalH = Math.ceil((b.maxN - b.minN) / metresPerPx);
  const nx = Math.ceil(totalW / maxPx);
  const ny = Math.ceil(totalH / maxPx);
  const stepE = (b.maxE - b.minE) / nx;
  const stepN = (b.maxN - b.minN) / ny;
  const out: { bbox: BBox; width: number; height: number }[] = [];
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++)
      out.push({
        bbox: {
          minE: b.minE + i * stepE,
          maxE: b.minE + (i + 1) * stepE,
          minN: b.minN + j * stepN,
          maxN: b.minN + (j + 1) * stepN,
        },
        width: Math.ceil(stepE / metresPerPx),
        height: Math.ceil(stepN / metresPerPx),
      });
  return out;
}
