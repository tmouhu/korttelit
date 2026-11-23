import { numberFormat, t } from '../i18n';
import type { Course } from '../core/course';
import { crowFlyLength, sequence } from '../core/course';
import { frameBBox, groundToPaper, mapAreaMm, northLineXs, PAPER_MM, sheetMm, wmsRequests, type PrintSetup } from '../core/printFrame';
import { buildDescriptions, type DescriptionSettings } from '../core/descriptions';
import { drawSheet, sheetSize, sheetSymbolIds } from './descriptionSheet';
import { ensureSymbols } from './symbols';
import { buildCourseScene, COURSE_COLOUR, NORTH_LINE_COLOUR, NORTH_LINE_MM, symbolSpecFor } from '../core/symbols';

export const MAPANT_WMS = 'https://www.mapant.fi/wms/wms.php';

export interface PdfOptions { dpi: number; onProgress?: (msg: string) => void; includeMap?: boolean; north?: { on: boolean; spacingMm: number }; description?: { settings: DescriptionSettings; ownPage: boolean } }
export interface PdfResult { blob: Blob; warnings: string[] }

export function wmsUrl(b: { minE: number; minN: number; maxE: number; maxN: number }, w: number, h: number): string {
  const q = new URLSearchParams({
    service: 'WMS', version: '1.1.1', request: 'GetMap', layers: 'MapAntFi', styles: '', srs: 'EPSG:3067',
    bbox: [b.minE, b.minN, b.maxE, b.maxN].map((v) => v.toFixed(3)).join(','), width: String(w), height: String(h), format: 'image/png',
  });
  return `${MAPANT_WMS}?${q}`;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('map-image-failed'));
    img.src = url;
  });
}

/**
 * Affine transform (for ctx.setTransform) from WMS image pixels to canvas pixels, where the canvas covers the
 * map area (origin at its top-left) at `k` pixels per paper mm.
 */
export function imageTransform(s: PrintSetup, bbox: { minE: number; maxE: number; minN: number; maxN: number }, w: number, h: number, k: number): [number, number, number, number, number, number] {
  const area = mapAreaMm(s);
  const m = (s.northGridBearingDeg * Math.PI) / 180;
  const f = 1000 / s.scale;
  const right = [Math.cos(m), -Math.sin(m)], up = [Math.sin(m), Math.cos(m)];
  const dE = (bbox.maxE - bbox.minE) / w, dN = (bbox.maxN - bbox.minN) / h;
  const origin = groundToPaper(s, { e: bbox.minE, n: bbox.maxN });
  return [
    k * dE * right[0]! * f, -k * dE * up[0]! * f,        // image +i
    -k * dN * right[1]! * f, k * dN * up[1]! * f,        // image +j (north decreases)
    (origin.x + area.w / 2) * k, (origin.y + area.h / 2) * k,
  ];
}

async function renderMapCanvas(s: PrintSetup, dpi: number, progress: (m: string) => void): Promise<HTMLCanvasElement> {
  const area = mapAreaMm(s);
  const k = dpi / 25.4;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(area.w * k); canvas.height = Math.round(area.h * k);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';

  const pad = 2; // px overlap to hide seams
  const mpp = (s.scale / 1000) * (25.4 / dpi);
  const reqs = wmsRequests(s, dpi, 3990);
  let done = 0;
  for (const r of reqs) {
    progress(t('pdf.loadingMap', { i: ++done, n: reqs.length }));
    const b = { minE: r.bbox.minE - pad * mpp, maxE: r.bbox.maxE + pad * mpp, minN: r.bbox.minN - pad * mpp, maxN: r.bbox.maxN + pad * mpp };
    const w = r.width + 2 * pad, h = r.height + 2 * pad;
    const img = await loadImage(wmsUrl(b, w, h));
    ctx.save();
    ctx.setTransform(...imageTransform(s, b, w, h, k));
    ctx.drawImage(img, 0, 0, w, h);
    ctx.restore();
  }
  void frameBBox;
  return canvas;
}

const hexToRgb = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
const fmt = (n: number): string => numberFormat(0).format(n);

/** "Korttelit" credit in the sheet margin: course-symbol mark + wordmark with the "o" drawn as a control circle. */
function drawBrand(doc: import('jspdf').jsPDF, x: number, y: number): void {
  const [r, g, b] = hexToRgb(COURSE_COLOUR);
  const mid = y; // vertical centre line of the credit
  doc.setDrawColor(r, g, b); doc.setLineWidth(0.25); doc.setLineCap('butt'); doc.setLineJoin('miter');
  // start triangle → leg → control circle → leg → finish
  doc.lines([[0, 3], [2.6, -1.5]], x, mid - 1.5 + 0, [1, 1], 'S', true);
  doc.line(x + 3.0, mid + 0.1, x + 4.3, mid - 0.6);
  doc.circle(x + 5.5, mid - 1.0, 1.25, 'S');
  doc.line(x + 6.3, mid + 0.0, x + 7.1, mid + 0.9);
  doc.circle(x + 7.9, mid + 1.5, 0.75, 'S'); doc.circle(x + 7.9, mid + 1.5, 0.35, 'S');
  // wordmark
  const tx = x + 10.2, size = 9;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(size); doc.setTextColor(21, 34, 46);
  const base = mid + 1.6;
  doc.text('K', tx, base);
  const kw = doc.getTextWidth('K');
  const ringR = 0.95;
  doc.setLineWidth(0.4); doc.setDrawColor(r, g, b); doc.circle(tx + kw + 0.2 + ringR, base - ringR - 0.15, ringR, 'S');
  doc.text('rttelit', tx + kw + 0.4 + 2 * ringR, base);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(0);
}

export async function exportPdf(course: Course, setup: PrintSetup, opts: PdfOptions): Promise<PdfResult> {
  const progress = opts.onProgress ?? (() => undefined);
  const warnings: string[] = [];
  const area = mapAreaMm(setup);
  const sheet = sheetMm(setup);
  const margin = setup.marginMm;
  const k = opts.dpi / 25.4;
  if (Math.round(area.w * k) * Math.round(area.h * k) > 36e6) warnings.push('large-image');

  for (const p of sequence(course)) {
    const q = groundToPaper(setup, p.pos);
    if (Math.abs(q.x) > area.w / 2 || Math.abs(q.y) > area.h / 2) { warnings.push('course-outside-frame'); break; }
  }

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: [PAPER_MM[setup.paper].w, PAPER_MM[setup.paper].h], orientation: setup.orientation, compress: true });
  void sheet;
  const ox = margin + area.w / 2, oy = margin + area.h / 2; // paper-mm origin → page mm

  if (opts.includeMap !== false) {
    const canvas = await renderMapCanvas(setup, opts.dpi, progress);
    progress(t('pdf.building'));
    doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, area.w, area.h, undefined, 'FAST');
  }

  // magnetic north lines (under the course)
  if (opts.north?.on) {
    const [nr, ng, nb] = hexToRgb(NORTH_LINE_COLOUR);
    doc.setDrawColor(nr, ng, nb); doc.setLineWidth(NORTH_LINE_MM); doc.setLineCap('butt');
    for (const x of northLineXs(setup, opts.north.spacingMm)) doc.line(ox + x, margin, ox + x, margin + area.h);
  }

  const [r, g, b] = hexToRgb(COURSE_COLOUR);
  const scene = buildCourseScene(course, setup, symbolSpecFor(setup.scale));
  doc.setLineCap('butt'); doc.setLineJoin('round');

  // number halos first (white stroke), then the course on top
  doc.setFont('helvetica', 'bold');
  for (const { prim: p } of scene) {
    if (p.kind !== 'text') continue;
    doc.setFontSize((p.sizeMm * 72) / 25.4);
    doc.setDrawColor(255, 255, 255); doc.setLineWidth(p.haloMm);
    doc.text(p.text, ox + p.x, oy + p.y + symbolSpecFor(setup.scale).numberHeightMm / 2, { align: 'center', renderingMode: 'stroke' });
  }
  doc.setDrawColor(r, g, b); doc.setTextColor(r, g, b);
  for (const { prim: p } of scene) {
    if (p.kind === 'ring') { doc.setLineWidth(p.width); doc.circle(ox + p.x, oy + p.y, p.r, 'S'); }
    else if (p.kind === 'polyline') {
      doc.setLineWidth(p.width);
      const pts = p.pts.map(([x, y]) => [ox + x, oy + y] as const);
      if (p.closed) {
        const segs = pts.slice(1).map((q, i) => [q[0] - pts[i]![0], q[1] - pts[i]![1]]);
        doc.lines(segs, pts[0]![0], pts[0]![1], [1, 1], 'S', true);
      } else doc.line(pts[0]![0], pts[0]![1], pts[1]![0], pts[1]![1]);
    } else {
      doc.setFontSize((p.sizeMm * 72) / 25.4);
      doc.text(p.text, ox + p.x, oy + p.y + symbolSpecFor(setup.scale).numberHeightMm / 2, { align: 'center' });
    }
  }

  // control description sheet (on the map and/or on its own page)
  if (opts.description && (opts.description.settings.include || opts.description.ownPage)) {
    const dd = buildDescriptions(course, setup.northGridBearingDeg);
    await ensureSymbols(sheetSymbolIds(dd));
    const meta = { title: course.name, lengthM: crowFlyLength(course) };
    const render = (cell: number): { url: string; w: number; h: number } => {
      const sz = sheetSize(dd.lines.length, cell);
      const kk = 600 / 25.4;
      const cv = document.createElement('canvas'); cv.width = Math.ceil(sz.w * kk); cv.height = Math.ceil(sz.h * kk);
      const cx = cv.getContext('2d')!; cx.scale(kk, kk); drawSheet(cx, dd, meta, cell);
      return { url: cv.toDataURL('image/png'), w: sz.w, h: sz.h };
    };
    if (opts.description.settings.include) {
      const d = opts.description.settings, img = render(d.cellMm);
      doc.addImage(img.url, 'PNG', ox + d.x, oy + d.y, img.w, img.h, undefined, 'FAST');
    }
    if (opts.description.ownPage) {
      const img = render(8);
      doc.addPage('a4', 'portrait');
      doc.setTextColor(0); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.addImage(img.url, 'PNG', 15, 15, img.w, img.h, undefined, 'FAST');
    }
    doc.setPage(1);
  }

  // map furniture
  doc.setDrawColor(0); doc.setLineWidth(0.2); doc.rect(margin, margin, area.w, area.h, 'S');
  if (margin >= 8) {
    doc.setTextColor(0); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    const info = `1:${setup.scale} · ${setup.paper} · ${t('pdf.info', { n: course.controls.length })} · ${fmt(crowFlyLength(course))} m`;
    doc.text(course.name, margin, margin - 2.5);
    doc.text(info, margin + area.w, margin - 2.5, { align: 'right' });
    // scale bar: longest of the nice lengths that fits in 60 mm
    const mmPerM = 1000 / setup.scale;
    const len = [1000, 500, 200, 100, 50].find((m) => m * mmPerM <= 60) ?? 50;
    const barY = margin + area.h + 5, barX = margin, barMm = len * mmPerM;
    doc.setLineWidth(0.3); doc.line(barX, barY, barX + barMm, barY);
    doc.line(barX, barY - 1.2, barX, barY + 1.2); doc.line(barX + barMm, barY - 1.2, barX + barMm, barY + 1.2);
    doc.setFontSize(7); doc.text(`${len} m`, barX + barMm + 2, barY + 1);
    doc.text(t('pdf.attribution'), margin + area.w, barY + 1, { align: 'right' });
    doc.text(t('pdf.north'), margin + area.w, barY + 4, { align: 'right' });
    drawBrand(doc, margin + area.w / 2 - 14, barY + 0.2);
  }
  return { blob: doc.output('blob'), warnings };
}
