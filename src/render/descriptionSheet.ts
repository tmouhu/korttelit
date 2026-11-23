import { CATALOGUE } from '../gen/catalogue';
import { COLUMNS, type Descriptions } from '../core/descriptions';
import { getSymbol } from './symbols';

export interface SheetMeta { title: string; lengthM: number }

export const SHEET_COLS = 8;

/** Size of the sheet in mm: title, length, start, one row per control, finish (+ legend lines). */
export function sheetSize(nControls: number, cell: number, legendLines = 0): { w: number; h: number } {
  return { w: SHEET_COLS * cell, h: (4 + nControls) * cell + legendLines * cell * 0.55 };
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
  const legend = d.legend.map((l) => `${l.symbol} = ${CATALOGUE[l.kind]?.label.fi ?? l.kind}`);
  const { w, h } = sheetSize(n, cell, legend.length);
  const tableH = (4 + n) * cell;
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
  for (let r = 1; r < 4 + n; r++) {
    const isHeader = r <= 2; const controlRow = r - 3; // 0-based control index of the row ABOVE this line is controlRow-1+...
    const heavy = r === 2 || r === 3 || (r > 3 && (r - 3) % 3 === 0) || r === 3 + n;
    void isHeader; void controlRow;
    line(0, r * cell, w, r * cell, heavy ? thick : thin);
  }
  // vertical lines (not through the merged heading rows)
  for (let c = 1; c < SHEET_COLS; c++) line(c * cell, 2 * cell, c * cell, tableH, thin);
  line(3 * cell, cell, 3 * cell, 2 * cell, thin); line(6 * cell, cell, 6 * cell, 2 * cell, thin);

  // heading
  text(meta.title, cell * 0.3, cell * 0.5, cell * 0.5, 'left', true);
  text(fmtKm(meta.lengthM), 4.5 * cell, cell * 1.5, cell * 0.5, 'center', true);

  // start row
  sym('start', 0, 2, 0.8);

  // controls
  d.lines.forEach((l, i) => {
    const row = 3 + i;
    text(String(l.number), cell * 0.5, (row + 0.5) * cell, cell * 0.55, 'center', true);
    text(l.code, cell * 1.5, (row + 0.5) * cell, cell * 0.55, 'center', false);
    COLUMNS.forEach((c, ci) => { const id = l.row[c]; if (id) sym(id, 2 + ci, row); });
  });

  // finish row: double circle in column A
  const fr = 3 + n;
  ctx.lineWidth = 0.35; ctx.beginPath(); ctx.arc(cell * 0.5, (fr + 0.5) * cell, cell * 0.33, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cell * 0.5, (fr + 0.5) * cell, cell * 0.2, 0, Math.PI * 2); ctx.stroke();

  // legend for special items (their meaning must be told to competitors)
  legend.forEach((s, i) => text(s, 0, tableH + cell * 0.3 + i * cell * 0.55, cell * 0.38, 'left'));
  ctx.restore();
}
