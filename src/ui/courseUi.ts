import type Map from 'ol/Map';
import PointerInteraction from 'ol/interaction/Pointer';
import type { MapBrowserEvent } from 'ol';
import { type CourseStore, type PointRef, addControl, crowFlyLength, deletePoint, legLengths, movePoint, reorderControl, sequence, setFinish, setLabelAngle, setStart } from '../core/course';
import { groundToPaper, mapAreaMm, paperToGround, type PrintSetup } from '../core/printFrame';
import { buildDescriptions, type DescriptionSettings } from '../core/descriptions';
import { drawSheet, sheetSize, sheetSymbolIds } from '../render/descriptionSheet';
import { ensureSymbols } from '../render/symbols';
import { CATALOGUE } from '../gen/catalogue';
import { getLang, numberFormat, t } from '../i18n';
import { buildCourseScene, COURSE_COLOUR, symbolSpecFor, type SceneItem } from '../core/symbols';

let debugPoints: [number, number, string][] = [];
let debugOn = false;
let redraw: () => void = () => undefined;
/** Show/hide generator candidate points (debug overlay, US-14). */
export function setDebugPoints(pts: [number, number, string][] | null, on?: boolean): void {
  if (pts) debugPoints = pts;
  if (on !== undefined) debugOn = on;
  redraw();
}

type Tool = 'select' | 'start' | 'control' | 'finish';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const nf = { format: (n: number): string => numberFormat(0).format(n) };
const refKey = (r: PointRef): string => (r.kind === 'control' ? r.id : r.kind);
const sameRef = (a: PointRef | null, b: PointRef | null): boolean => !!a && !!b && refKey(a) === refKey(b);

export interface DescAccess { get: () => DescriptionSettings; set: (d: DescriptionSettings) => void }

export function setupCourseUi(map: Map, getSetup: () => PrintSetup, store: CourseStore, onSetupRequest: () => void, desc: DescAccess): void {
  let tool: Tool = 'control';
  let selected: PointRef | null = null;

  // ---------- overlay canvas (renders the shared mm-based scene) ----------
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1';
  map.getViewport()!.appendChild(canvas);

  const px = (e: number, n: number): [number, number] => map.getPixelFromCoordinate([e, n]) as [number, number];
  const pxPerMm = (): number => getSetup().scale / 1000 / map.getView().getResolution()!;
  const paperToPx = (x: number, y: number): [number, number] => {
    const g = paperToGround(getSetup(), x, y);
    return map.getPixelFromCoordinate([g.e, g.n]) as [number, number];
  };

  function draw(): void {
    const size = map.getSize();
    if (!size) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== size[0]! * dpr || canvas.height !== size[1]! * dpr) {
      canvas.width = size[0]! * dpr; canvas.height = size[1]! * dpr;
      canvas.style.width = `${size[0]}px`; canvas.style.height = `${size[1]}px`;
    }
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size[0]!, size[1]!);
    const k = pxPerMm();
    const scene = buildCourseScene(store.course, getSetup());
    if (debugOn) {
      ctx.save(); ctx.fillStyle = 'rgba(0,120,215,.75)';
      for (const [e, n] of debugPoints) { const q = px(e, n); if (q[0] < -5 || q[1] < -5 || q[0] > size[0]! + 5 || q[1] > size[1]! + 5) continue; ctx.beginPath(); ctx.arc(q[0], q[1], 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
    // white halos first so no number is covered by another number's halo
    for (const { prim: p } of scene) {
      if (p.kind !== 'text') continue;
      const [x, y] = paperToPx(p.x, p.y);
      ctx.font = `bold ${p.sizeMm * k}px Arial, Helvetica, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.strokeStyle = '#fff'; ctx.lineWidth = p.haloMm * k;
      ctx.strokeText(p.text, x, y + (symbolSpecFor(getSetup().scale).numberHeightMm * k) / 2);
    }
    ctx.strokeStyle = COURSE_COLOUR; ctx.fillStyle = COURSE_COLOUR;
    for (const { prim: p, ref } of scene) {
      const sel = selected && ref === refKey(selected);
      ctx.strokeStyle = COURSE_COLOUR;
      if (p.kind === 'ring') {
        const [x, y] = paperToPx(p.x, p.y);
        ctx.lineWidth = p.width * k; ctx.beginPath(); ctx.arc(x, y, p.r * k, 0, Math.PI * 2); ctx.stroke();
        if (sel) { ctx.save(); ctx.strokeStyle = '#1976d2'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(x, y, p.r * k + 6, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      } else if (p.kind === 'polyline') {
        ctx.lineWidth = p.width * k; ctx.beginPath();
        p.pts.forEach(([px, py], i) => { const [x, y] = paperToPx(px, py); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        if (p.closed) ctx.closePath();
        ctx.stroke();
      } else {
        const [x, y] = paperToPx(p.x, p.y);
        ctx.font = `bold ${p.sizeMm * k}px Arial, Helvetica, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(p.text, x, y + (symbolSpecFor(getSetup().scale).numberHeightMm * k) / 2);
      }
    }
    drawSheetOverlay(ctx);
  }
  // ---------- description sheet overlay ----------
  const sheetRect = (): { x: number; y: number; w: number; h: number } => {
    const d = desc.get(); const dd = buildDescriptions(store.course, getSetup().northGridBearingDeg);
    const sz = sheetSize(dd.lines.length, d.cellMm, dd.legend.length);
    return { x: d.x, y: d.y, w: sz.w, h: sz.h };
  };
  const pending = new Set<string>();
  function drawSheetOverlay(ctx: CanvasRenderingContext2D): void {
    const d = desc.get(); if (!d.include) return;
    const dd = buildDescriptions(store.course, getSetup().northGridBearingDeg);
    const ids = sheetSymbolIds(dd).filter((i) => !pending.has(i));
    if (ids.length) { ids.forEach((i) => pending.add(i)); void ensureSymbols(ids).then(() => map.render()); }
    const r = sheetRect();
    const o = paperToPx(r.x, r.y), e1 = paperToPx(r.x + 1, r.y);
    const k = Math.hypot(e1[0] - o[0], e1[1] - o[1]), ang = Math.atan2(e1[1] - o[1], e1[0] - o[0]);
    ctx.save(); ctx.translate(o[0], o[1]); ctx.rotate(ang); ctx.scale(k, k);
    drawSheet(ctx, dd, { title: store.course.name, lengthM: crowFlyLength(store.course) }, d.cellMm);
    ctx.restore();
  }
  const paperAt = (pix: number[]): { x: number; y: number } => { const g = map.getCoordinateFromPixel(pix)!; return groundToPaper(getSetup(), { e: g[0]!, n: g[1]! }); };
  const hitSheet = (pix: number[]): boolean => {
    if (!desc.get().include) return false;
    const r = sheetRect(), q = paperAt(pix);
    return q.x >= r.x && q.x <= r.x + r.w && q.y >= r.y && q.y <= r.y + r.h;
  };
  const snapSheet = (): void => {
    const d = desc.get(), r = sheetRect(), a = mapAreaMm(getSetup()), inset = 3, thr = 8;
    let x = d.x, y = d.y;
    const left = -a.w / 2 + inset, right = a.w / 2 - inset - r.w, top = -a.h / 2 + inset, bottom = a.h / 2 - inset - r.h;
    if (Math.abs(x - left) < thr) x = left; else if (Math.abs(x - right) < thr) x = right;
    if (Math.abs(y - top) < thr) y = top; else if (Math.abs(y - bottom) < thr) y = bottom;
    desc.set({ ...d, x, y });
  };

  map.on('postrender', draw);
  redraw = () => map.render();

  // ---------- hit testing ----------
  function hitPoint(pix: number[]): PointRef | null {
    let best: PointRef | null = null, bd = 14;
    for (const s of sequence(store.course)) {
      const [x, y] = px(s.pos.e, s.pos.n);
      const d = Math.hypot(x - pix[0]!, y - pix[1]!);
      if (d < Math.max(bd, 0) && d <= Math.max(14, 3.5 * pxPerMm())) { bd = d; best = s.ref; }
    }
    return best;
  }
  function hitLabel(pix: number[], scene: SceneItem[]): string | null {
    for (const { prim: p, ref } of scene) {
      if (p.kind !== 'text' || !ref) continue;
      const [x, y] = paperToPx(p.x, p.y);
      if (Math.hypot(x - pix[0]!, y - pix[1]!) < Math.max(10, 3 * pxPerMm())) return ref;
    }
    return null;
  }
  function hitLeg(pix: number[]): number | null {
    const seq = sequence(store.course);
    for (let i = 0; i + 1 < seq.length; i++) {
      const [ax, ay] = px(seq[i]!.pos.e, seq[i]!.pos.n), [bx, by] = px(seq[i + 1]!.pos.e, seq[i + 1]!.pos.n);
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((pix[0]! - ax) * dx + (pix[1]! - ay) * dy) / l2));
      if (Math.hypot(ax + t * dx - pix[0]!, ay + t * dy - pix[1]!) <= 8) return i; // index of the leg's first point in the sequence
    }
    return null;
  }

  // ---------- dragging points and labels ----------
  let drag: { kind: 'point'; ref: PointRef } | { kind: 'label'; id: string } | { kind: 'sheet'; dx: number; dy: number } | null = null;
  const dragger = new PointerInteraction({
    handleDownEvent(e: MapBrowserEvent) {
      const pix = e.pixel;
      if (hitSheet(pix)) { const q = paperAt(pix), d = desc.get(); drag = { kind: 'sheet', dx: q.x - d.x, dy: q.y - d.y }; return true; }
      const label = hitLabel(pix, buildCourseScene(store.course, getSetup()));
      const pt = hitPoint(pix);
      if (label && label !== 'start' && label !== 'finish' && !pt) { drag = { kind: 'label', id: label }; store.begin(); return true; }
      if (pt) { drag = { kind: 'point', ref: pt }; selected = pt; store.begin(); refresh(); return true; }
      return false;
    },
    handleDragEvent(e: MapBrowserEvent) {
      if (!drag) return;
      const c = e.coordinate;
      if (drag.kind === 'sheet') { const q = paperAt(e.pixel); desc.set({ ...desc.get(), x: q.x - drag.dx, y: q.y - drag.dy }); map.render(); return; }
      if (drag.kind === 'point') store.live(movePoint(store.course, drag.ref, { e: c[0]!, n: c[1]! }));
      else {
        const ctl = store.course.controls.find((k) => k.id === (drag as { id: string }).id);
        if (!ctl) return;
        const a = groundToPaper(getSetup(), ctl.pos), b = groundToPaper(getSetup(), { e: c[0]!, n: c[1]! });
        const ang = (Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI;
        store.live(setLabelAngle(store.course, drag.id, ang));
      }
    },
    handleUpEvent() { if (drag) { if (drag.kind === 'sheet') snapSheet(); else store.end(); drag = null; map.render(); onSetupRequest(); } return false; },
  });
  // OpenLayers offers events to interactions from the LAST added to the first, so add ours last to get priority
  // over the frame's Translate and the default DragPan.
  map.addInteraction(dragger);

  // ---------- clicking places points ----------
  map.on('click', (e) => {
    const pix = e.pixel;
    if (hitSheet(pix)) return;
    const hit = hitPoint(pix);
    if (hit) { selected = hit; refresh(); return; }
    const pos = { e: e.coordinate[0]!, n: e.coordinate[1]! };
    if (tool === 'start') { store.commit(setStart(store.course, pos)); setTool('control'); }
    else if (tool === 'finish') { store.commit(setFinish(store.course, pos)); setTool('select'); }
    else if (tool === 'control') {
      const leg = hitLeg(pix);
      const seq = sequence(store.course);
      // inserting on a leg: new control goes after the leg's first point, counted among controls only
      let index = store.course.controls.length;
      if (leg !== null) index = seq.slice(0, leg + 1).filter((s) => s.ref.kind === 'control').length;
      store.commit(addControl(store.course, pos, index));
      selected = { kind: 'control', id: store.course.controls[Math.min(index, store.course.controls.length - 1)]!.id };
    } else selected = null;
    refresh();
  });

  // ---------- sidebar ----------
  function setTool(t: Tool): void {
    tool = t;
    document.querySelectorAll<HTMLInputElement>('input[name=tool]').forEach((r) => { r.checked = r.value === t; });
    { const el = map.getTargetElement(); if (el) el.style.cursor = t === "select" ? "" : "crosshair"; }
  }
  document.querySelectorAll<HTMLInputElement>('input[name=tool]').forEach((r) => r.addEventListener('change', () => setTool(r.value as Tool)));
  setTool('control');

  function renderList(): void {
    const c = store.course;
    const lens = legLengths(c);
    const seq = sequence(c);
    const ul = $('courseList');
    ul.innerHTML = '';
    seq.forEach((s, i) => {
      const li = document.createElement('li');
      if (sameRef(selected, s.ref)) li.className = 'sel';
      const name = s.ref.kind === 'start' ? t('list.start') : s.ref.kind === 'finish' ? t('list.finish') : s.label!;
      const leg = i > 0 ? `<small>${nf.format(lens[i - 1]!)} m</small>` : '<small></small>';
      const ctl = s.ref.kind === 'control' ? c.controls.find((k) => k.id === (s.ref as { id: string }).id) : undefined;
      const kind = ctl?.kind && CATALOGUE[ctl.kind] ? `<small class="k">${CATALOGUE[ctl.kind]!.label[getLang()]}</small>` : '';
      li.innerHTML = `<span class="n">${name}</span><span>${leg}${kind}</span>`;
      li.addEventListener('click', () => { selected = s.ref; refresh(); });
      const btns = document.createElement('span');
      const mk = (txt: string, title: string, fn: () => void, disabled = false): void => {
        const b = document.createElement('button'); b.textContent = txt; b.title = title; b.disabled = disabled;
        b.addEventListener('click', (ev) => { ev.stopPropagation(); fn(); }); btns.appendChild(b);
      };
      if (s.ref.kind === 'control' && ctl) {
        mk(ctl.locked ? '🔒' : '🔓', ctl.locked ? t('unlock') : t('lock'), () => store.commit({ ...store.course, controls: store.course.controls.map((k) => (k.id === ctl.id ? { ...k, locked: !k.locked } : k)) }));
      }
      if (s.ref.kind === 'control') {
        const idx = c.controls.findIndex((k) => k.id === (s.ref as { id: string }).id);
        mk('↑', t('up'), () => store.commit(reorderControl(store.course, idx, idx - 1)), idx === 0);
        mk('↓', t('down'), () => store.commit(reorderControl(store.course, idx, idx + 1)), idx === c.controls.length - 1);
      }
      mk('✕', t('delete'), () => { store.commit(deletePoint(store.course, s.ref)); if (sameRef(selected, s.ref)) selected = null; });
      li.appendChild(btns);
      ul.appendChild(li);
    });
    $('stats').textContent = t('stats', { n: c.controls.length, len: nf.format(crowFlyLength(c)) });
    ($('undo') as HTMLButtonElement).disabled = !store.canUndo;
    ($('redo') as HTMLButtonElement).disabled = !store.canRedo;
  }
  function refresh(): void { renderList(); map.render(); }

  $('undo').addEventListener('click', () => store.undo());
  $('redo').addEventListener('click', () => store.redo());
  $('clearCourse').addEventListener('click', () => { if (confirm(t('clear.confirm'))) store.commit({ ...store.course, controls: [], start: undefined, finish: undefined }); });
  ($('firstNumber') as HTMLInputElement).addEventListener('input', (e) => {
    const v = Math.max(1, Math.floor(Number((e.target as HTMLInputElement).value) || 1));
    store.commit({ ...store.course, firstNumber: v });
  });
  window.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? store.redo() : store.undo(); }
    else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); store.redo(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { store.commit(deletePoint(store.course, selected)); selected = null; }
    else if (e.key === 'Escape') { setTool('select'); selected = null; refresh(); }
  });

  store.subscribe(() => { refresh(); onSetupRequest(); });
  refresh();
}
