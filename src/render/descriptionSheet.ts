import { COLUMNS, type Descriptions } from '../core/descriptions';
import { getSymbol } from './symbols';

export interface SheetMeta { title: string; lengthM: number }

export const SHEET_COLS = 8;

/** Size of the sheet in mm: length, start, one row per control, finish (no title row: the course name is printed on the map sheet). */
export function sheetSize(nControls: number, cell: number): { w: number; h: number } {
  return { w: SHEET_COLS * cell, h: (3 + nControls) * cell };
}

/** All symbol ids needed to draw the sheet. */
export function sheetSymbolIds(d: Descriptions): string[] {
  const ids = ['start'];
  for (const l of d.lines) for (const c of COLUMNS) { const s = l.row[c]; if (s) ids.push(s); }
  return ids;
}

const fmtKm = (m: number): string => `${(Math.round(m / 100) / 10).toFixed(1).replace('.', ',')} km`;

/**
 * Draw the IOF-style description sheet with its top-left corner at the origin, in millimetres
 * (the caller scales the context). Symbols must have been loaded with ensureSymbols().
 */
export function drawSheet(ctx: CanvasRenderingContext2D, d: Descriptions, meta: SheetMeta, cell: number): void {
  const n = d.lines.length;
  const { w, h } = sheetSize(n, cell);
  const tableH = (3 + n) * cell;
  ctx.save();
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#000'; ctx.fillStyle = '#000'; ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';

  const line = (x1: number, y1: number, x2: number, y2: number, lw: number): void => { ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  const text = (s: string, x: number, y: number, size: number, align: CanvasTextAlign = 'center', bold = false): void => {
    ctx.font = `${bold ? 'bold ' : ''}${size}px Arial, Helvetica, sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y);
  };
  const sym = (id: string, col: number, row: number, scale = 0.86): void => {
    const img = getSymbol(id); if (!img) return;
    const s = cell * scale; ctx.drawImage(img, col * cell + (cell - s) / 2, row * cell + (cell - s) / 2, s, s);
  };

  // grid
  const thin = 0.1, thick = 0.35;
  line(0, 0, w, 0, thick); line(0, tableH, w, tableH, thick); line(0, 0, 0, tableH, thick); line(w, 0, w, tableH, thick);
  for (let r = 1; r < 3 + n; r++) {
    const heavy = r === 1 || r === 2 || (r > 2 && (r - 2) % 3 === 0) || r === 2 + n; // after heading, start, every third control, before finish
    line(0, r * cell, w, r * cell, heavy ? thick : thin);
  }
  // vertical lines (the length row is split in three: 3 + 3 + 2 cells)
  for (let c = 1; c < SHEET_COLS; c++) line(c * cell, cell, c * cell, tableH, thin);
  line(3 * cell, 0, 3 * cell, cell, thin); line(6 * cell, 0, 6 * cell, cell, thin);

  // heading: course length only
  text(fmtKm(meta.lengthM), 4.5 * cell, cell * 0.5, cell * 0.5, 'center', true);

  // start row
  sym('start', 0, 1, 0.8);

  // controls
  d.lines.forEach((l, i) => {
    const row = 2 + i;
    text(String(l.number), cell * 0.5, (row + 0.5) * cell, cell * 0.55, 'center', true);
    text(l.code, cell * 1.5, (row + 0.5) * cell, cell * 0.55, 'center', false);
    COLUMNS.forEach((c, ci) => { const id = l.row[c]; if (id) sym(id, 2 + ci, row); });
  });

  // finish row: double circle in column A
  const fr = 2 + n;
  ctx.lineWidth = 0.35; ctx.beginPath(); ctx.arc(cell * 0.5, (fr + 0.5) * cell, cell * 0.33, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cell * 0.5, (fr + 0.5) * cell, cell * 0.2, 0, Math.PI * 2); ctx.stroke();

  ctx.restore();
}
