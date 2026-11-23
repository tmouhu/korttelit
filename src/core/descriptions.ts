import { type Course, type Control, type DescColumn } from './course';

/**
 * Control descriptions (IOF control description columns C–H). Symbol ids follow the svg-control-descriptions
 * package (Purple Pen's numbering), e.g. '5.11' building, '11.5SW' south-west corner (outside).
 * NOTE: this numbering is close to, but not identical with, the 2018 specification's reference numbers.
 */
export type DescRow = Partial<Record<DescColumn, string>>;
export const COLUMNS: DescColumn[] = ['c', 'd', 'e', 'f', 'g', 'h'];

type GKind = 'corner-out' | 'corner-in' | 'end';
interface KindSymbols { d?: string; f?: string; g?: GKind; /** needs a "special item" (6.x) with an explanation */ special?: boolean }

/** Catalogue kind → description symbols (US-26). Mapping is deliberately conservative. */
export const KIND_SYMBOLS: Record<string, KindSymbols> = {
  building_corner: { d: '5.11', g: 'corner-out' },
  path_junction: { d: '5.2', f: '10.2' },
  bridge: { d: '5.4' },
  steps: { d: '5.24' },
  fence_corner: { d: '5.9', g: 'corner-out' },
  wall_corner: { d: '5.8', g: 'corner-out' },
  statue: { d: '5.20' },
  cross: { d: '5.20' },
  fountain: { d: '3.11' },
  well: { d: '3.9' },
  shelter: { d: '5.11' },
  toilets: { d: '5.11' },
  tower: { d: '5.15' },
  boulder: { d: '2.4' },
  landmark_tree: { d: '4.9' },
  park_corner: { d: '4.1', g: 'corner-in' },
  wood_corner: { d: '4.3' },
  bench: { special: true }, picnic_table: { special: true }, flagpole: { special: true }, bus_stop: { special: true }, viewpoint: { special: true }, clock: { special: true },
};

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export type Compass = (typeof DIRS)[number];

/** 8-point compass direction of a map bearing (0 = up on the sheet = magnetic north). */
export function compass(mapBearingDeg: number): Compass {
  const b = ((mapBearingDeg % 360) + 360) % 360;
  return DIRS[Math.round(b / 45) % 8]!;
}

export interface SpecialItem { symbol: '6.1' | '6.2'; kind: string }

/** Assign the two available "special item" symbols to feature kinds in order of first use; further kinds stay blank. */
export function assignSpecial(controls: Control[]): { bySpecialKind: Record<string, string>; legend: SpecialItem[]; unresolved: string[] } {
  const bySpecialKind: Record<string, string> = {};
  const legend: SpecialItem[] = [];
  const unresolved: string[] = [];
  for (const c of controls) {
    if (!c.kind || !KIND_SYMBOLS[c.kind]?.special || bySpecialKind[c.kind] || unresolved.includes(c.kind)) continue;
    if (legend.length < 2) { const symbol = legend.length === 0 ? '6.1' : '6.2'; bySpecialKind[c.kind] = symbol; legend.push({ symbol, kind: c.kind }); }
    else unresolved.push(c.kind);
  }
  return { bySpecialKind, legend, unresolved };
}

/** Automatic description of one control. `northGridBearingDeg` = grid bearing of the sheet's "up" (magnetic north). */
export function autoRow(c: Control, northGridBearingDeg: number, specials: Record<string, string>): DescRow {
  const k = c.kind ? KIND_SYMBOLS[c.kind] : undefined;
  if (!k) return {};
  const row: DescRow = {};
  if (k.special) { const s = c.kind ? specials[c.kind] : undefined; if (s) row.d = s; return row; }
  if (k.d) row.d = k.d;
  if (k.f) row.f = k.f;
  if (k.g && c.dirGridDeg !== undefined) {
    const dir = compass(c.dirGridDeg - northGridBearingDeg);
    row.g = (k.g === 'corner-out' ? '11.5' : k.g === 'corner-in' ? '11.4' : '11.8') + dir;
  }
  return row;
}

export interface DescLine { index: number; number: number; code: string; kind?: string; auto: DescRow; row: DescRow }
export interface Descriptions { lines: DescLine[]; legend: SpecialItem[]; unresolvedKinds: string[] }

/** Resolve overrides over automatic rows for the whole course. */
export function buildDescriptions(course: Course, northGridBearingDeg: number): Descriptions {
  const sp = assignSpecial(course.controls);
  const lines = course.controls.map((c, i): DescLine => {
    const auto = autoRow(c, northGridBearingDeg, sp.bySpecialKind);
    const row: DescRow = { ...auto };
    for (const col of COLUMNS) { const o = c.desc?.[col]; if (o !== undefined) { if (o === '') delete row[col]; else row[col] = o; } }
    return { index: i, number: i + 1, code: String(course.firstNumber + i), kind: c.kind, auto, row };
  });
  return { lines, legend: sp.legend, unresolvedKinds: sp.unresolved };
}

/** Which description columns a symbol can be used in, from the package's "kind" letter. */
export const columnOfSymbolKind = (kind: string): DescColumn | undefined => (['C', 'D', 'E', 'F', 'G', 'H'].includes(kind) ? (kind.toLowerCase() as DescColumn) : undefined);

export interface DescriptionSettings { include: boolean; /** top-left of the sheet in paper mm, relative to the centre of the map area */ x: number; y: number; cellMm: 5 | 6 | 7 }
