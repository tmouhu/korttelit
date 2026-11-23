import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import Feature from 'ol/Feature';
import Polygon from 'ol/geom/Polygon';
import { Vector as VectorLayer } from 'ol/layer';
import TileLayer from 'ol/layer/Tile';
import VectorSource from 'ol/source/Vector';
import TileWMS from 'ol/source/TileWMS';
import Translate from 'ol/interaction/Translate';
import { Stroke, Style } from 'ol/style';
import { register } from 'ol/proj/proj4';
import { get as getProjection } from 'ol/proj';
import proj4 from 'proj4';
import { northInfo } from './core/declination';
import { applyStatic, getLang, hasKey as dictHas, numberFormat, setLang, t, type Lang, type MessageKey } from './i18n';
import { groundSizeM, frameCorners, type PrintSetup, type PaperSize, type Orientation } from './core/printFrame';
import { lonLatToTM35, TM35FIN_CODE, deg2rad } from './core/projection';
import { CourseStore, emptyCourse } from './core/course';
import { setupCourseUi, setDebugPoints } from './ui/courseUi';
import { buildDescriptions, type DescriptionSettings } from './core/descriptions';
import { sheetSize } from './render/descriptionSheet';
import { CATALOGUE } from './gen/catalogue';
import { frameBBox, groundToPaper, mapAreaMm, wmsRequests } from './core/printFrame';
import { defaultSettings } from './gen/generator';
import type { Slot } from './gen/generator';
import { newControlId } from './core/course';

register(proj4);
const projection = getProjection(TM35FIN_CODE)!;
projection.setExtent([41637, 6580234, 754341, 7800842]);

const fmt = numberFormat(1);
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const hki = lonLatToTM35({ lon: 24.9384, lat: 60.1699 });
const state: PrintSetup & { autoRotation: boolean; manualRotation: number } = {
  centre: hki, paper: 'A4', orientation: 'portrait', scale: 4000, marginMm: 10,
  northGridBearingDeg: 0, autoRotation: true, manualRotation: 0,
};

const frameFeature = new Feature(new Polygon([[]]));
frameFeature.setStyle(new Style({
  stroke: new Stroke({ color: '#c2185b', width: 3 }),
}));
const frameSource = new VectorSource({ features: [frameFeature] });

const map = new Map({
  target: 'map',
  layers: [
    new TileLayer({
      source: new TileWMS({
        url: 'https://www.mapant.fi/wms/wms.php',
        params: { LAYERS: 'MapAntFi', VERSION: '1.1.1', FORMAT: 'image/png', STYLES: '' },
        projection,
        crossOrigin: 'anonymous',
        serverType: 'mapserver',
        attributions: 'MapAnt.fi / Maanmittauslaitos (CC BY 4.0)',
      }),
    }),
    new VectorLayer({ source: frameSource }),
  ],
  view: new View({ projection, center: [hki.e, hki.n], resolution: 2, rotation: 0, constrainRotation: false }),
});

function currentNorthBearing(): number {
  if (!state.autoRotation) return state.manualRotation;
  return northInfo(state.centre).magneticNorthGridBearingDeg;
}

let translating = false;
function update(rotateView = true): void {
  state.northGridBearingDeg = currentNorthBearing();
  const ring = frameCorners(state).map((p) => [p.e, p.n]);
  ring.push(ring[0]!);
  if (!translating) frameFeature.setGeometry(new Polygon([ring]));
  // OpenLayers rotation is clockwise-positive; paper "up" = magnetic north so rotate content counter-clockwise.
  if (rotateView) map.getView().setRotation(-deg2rad(state.northGridBearingDeg));
  const g = groundSizeM(state);
  const n = northInfo(state.centre);
  $('rot').toggleAttribute('disabled', state.autoRotation);
  if (state.autoRotation) ($('rot') as HTMLInputElement).value = state.northGridBearingDeg.toFixed(1);
  const rows: [string, string][] = [
    [t('info.area'), `${fmt.format(g.w)} × ${fmt.format(g.h)} m`],
    [t('info.centreE'), fmt.format(state.centre.e)],
    [t('info.centreN'), fmt.format(state.centre.n)],
    [t('info.decl'), `${n.declinationDeg >= 0 ? '+' : ''}${fmt.format(n.declinationDeg)}°`],
    [t('info.conv'), `${fmt.format(-n.trueNorthGridBearingDeg)}°`],
    [t('info.rot'), `${fmt.format(state.northGridBearingDeg)}°`],
    [t('info.margin'), `${state.marginMm} mm`],
  ];
  $('info').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  updateWarnings();
}

// Mapant coverage (EPSG:3067 extent from its WMS capabilities)
const MAPANT_EXTENT = { minE: 41637, minN: 6580234, maxE: 754341, maxN: 7800842 };
function updateWarnings(): void {
  const msgs: string[] = [];
  if (frameCorners(state).some((p) => p.e < MAPANT_EXTENT.minE || p.e > MAPANT_EXTENT.maxE || p.n < MAPANT_EXTENT.minN || p.n > MAPANT_EXTENT.maxN)) msgs.push(t('warn.outside'));
  const a = mapAreaMm(state), dpi = Number((document.getElementById('dpi') as HTMLSelectElement | null)?.value ?? 300);
  const mp = (a.w * dpi / 25.4) * (a.h * dpi / 25.4) / 1e6;
  if (mp > 25) msgs.push(t('warn.large', { mp: Math.round(mp) }));
  $('warn').innerHTML = msgs.join('<br>');
}

// Dragging the frame moves the print area.
// The frame has no fill, so only its outline (±8 px) can be grabbed; the inside stays free for objects and panning.
const dragFeatures = new Translate({ filter: (f) => f === frameFeature, hitTolerance: 8 });
dragFeatures.on('translatestart', () => { translating = true; });
dragFeatures.on('translateend', () => {
  const ring = (frameFeature.getGeometry() as Polygon).getCoordinates()[0]!.slice(0, 4);
  state.centre = {
    e: ring.reduce((a, c) => a + c[0]!, 0) / 4,
    n: ring.reduce((a, c) => a + c[1]!, 0) / 4,
  };
  translating = false;
  update(false);
});
map.addInteraction(dragFeatures);

$('paper').addEventListener('change', (e) => { state.paper = (e.target as HTMLSelectElement).value as PaperSize; update(); });
$('orientation').addEventListener('change', (e) => { state.orientation = (e.target as HTMLSelectElement).value as Orientation; update(); });
$('scale').addEventListener('change', (e) => { state.scale = Number((e.target as HTMLSelectElement).value); update(); });
$('autoRot').addEventListener('change', (e) => {
  state.autoRotation = (e.target as HTMLInputElement).checked;
  if (!state.autoRotation) state.manualRotation = state.northGridBearingDeg;
  update();
});
$('rot').addEventListener('input', (e) => {
  const v = Number((e.target as HTMLInputElement).value);
  if (Number.isFinite(v)) { state.manualRotation = v; update(); }
});
$('centre').addEventListener('click', () => {
  const c = map.getView().getCenter()!;
  state.centre = { e: c[0]!, n: c[1]! };
  update();
});
$('fit').addEventListener('click', () => {
  const g = frameFeature.getGeometry()!;
  map.getView().fit(g.getExtent(), { padding: [30, 30, 30, 30], size: map.getSize() });
  map.getView().setRotation(-deg2rad(state.northGridBearingDeg));
});

// ---- course + autosave (localStorage; failures are ignored) ----
const KEY = 'osm-korttelit:v1';
const store = new CourseStore(emptyCourse(t('course.default')));
const defaultDescPos = (): { x: number; y: number } => { const a = mapAreaMm(state); return { x: -a.w / 2 + 3, y: -a.h / 2 + 3 }; };
const desc: DescriptionSettings = { include: false, ...defaultDescPos(), cellMm: 6 };
try {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  if (saved?.course) store.course = saved.course;
  if (saved?.desc) Object.assign(desc, saved.desc);
  if (saved?.setup) {
    const s = saved.setup;
    Object.assign(state, { centre: s.centre ?? state.centre, paper: s.paper ?? state.paper, orientation: s.orientation ?? state.orientation, scale: s.scale ?? state.scale, autoRotation: s.autoRotation ?? true, manualRotation: s.manualRotation ?? 0 });
    ($('paper') as HTMLSelectElement).value = state.paper;
    ($('orientation') as HTMLSelectElement).value = state.orientation;
    ($('scale') as HTMLSelectElement).value = String(state.scale);
    ($('autoRot') as HTMLInputElement).checked = state.autoRotation;
    ($('firstNumber') as HTMLInputElement).value = String(store.course.firstNumber);
  }
} catch { /* ignore */ }
function save(): void {
  try { localStorage.setItem(KEY, JSON.stringify({ course: store.course, desc, setup: { centre: state.centre, paper: state.paper, orientation: state.orientation, scale: state.scale, autoRotation: state.autoRotation, manualRotation: state.manualRotation } })); } catch { /* ignore */ }
}
const baseUpdate = update;
const descInfo = (): void => {
  const dd = buildDescriptions(store.course, state.northGridBearingDeg);
  const lines: string[] = [];
  dd.legend.forEach((l) => lines.push(`${l.symbol} = ${CATALOGUE[l.kind]?.label[getLang()] ?? l.kind}`));
  if (dd.unresolvedKinds.length) lines.push(t('desc.noSymbol', { kinds: dd.unresolvedKinds.map((k) => CATALOGUE[k]?.label[getLang()] ?? k).join(', ') }));
  if (desc.include) {
    const sz = sheetSize(dd.lines.length, desc.cellMm, dd.legend.length);
    const hit = [...(store.course.start ? [store.course.start.pos] : []), ...store.course.controls.map((c) => c.pos), ...(store.course.finish ? [store.course.finish.pos] : [])]
      .filter((p): p is { e: number; n: number } => !!p).some((p) => { const q = groundToPaper(state, p); return q.x > desc.x - 4 && q.x < desc.x + sz.w + 4 && q.y > desc.y - 4 && q.y < desc.y + sz.h + 4; });
    if (hit) lines.push(t('desc.overlap'));
  }
  $('descInfo').innerHTML = lines.map((l) => l.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('<br>');
};
const descAccess = { get: () => desc, set: (d: DescriptionSettings) => { Object.assign(desc, d); } };
setupCourseUi(map, () => state, store, () => { save(); map.render(); descInfo(); }, descAccess);
($('descInclude') as HTMLInputElement).checked = desc.include;
($('descCell') as HTMLSelectElement).value = String(desc.cellMm);
$('descInclude').addEventListener('change', (e) => { desc.include = (e.target as HTMLInputElement).checked; save(); map.render(); descInfo(); });
$('descCell').addEventListener('change', (e) => { desc.cellMm = Number((e.target as HTMLSelectElement).value) as 5 | 6 | 7; save(); map.render(); descInfo(); });
$('descEdit').addEventListener('click', async () => { const { openDescriptionEditor } = await import('./ui/descriptionEditor'); openDescriptionEditor(store, () => state.northGridBearingDeg, () => { save(); map.render(); }); });
descInfo();
map.on('postrender', () => { /* overlay redraws itself */ });
['paper', 'orientation', 'scale', 'autoRot', 'rot'].forEach((id) => $(id).addEventListener('change', () => { save(); map.render(); }));
dragFeatures.on('translateend', () => { save(); map.render(); });
void baseUpdate;

// ---- export / import ----
const status = (msg: string): void => { $('status').textContent = msg; };
function download(blob: Blob, name: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
const fileBase = (): string => (store.course.name || 'rata').replace(/[^\p{L}\p{N}_-]+/gu, '_');
let disclaimerAccepted = false;
const confirmDisclaimer = (): boolean => disclaimerAccepted || (disclaimerAccepted = confirm(t('disclaimer')));
$('pdf').addEventListener('click', async () => {
  if (!confirmDisclaimer()) return;
  const btn = $('pdf') as HTMLButtonElement; btn.disabled = true;
  try {
    const { exportPdf } = await import('./render/pdf');
    const res = await exportPdf(store.course, { ...state, northGridBearingDeg: state.northGridBearingDeg }, { dpi: Number(($('dpi') as HTMLSelectElement).value), onProgress: status, description: { settings: desc, ownPage: ($('descPage') as HTMLInputElement).checked } });
    download(res.blob, `${fileBase()}_${state.paper}_1-${state.scale}.pdf`);
    status(res.warnings.includes('course-outside-frame') ? t('pdf.outside') : t('pdf.done'));
  } catch (e) { status(t('pdf.failed', { msg: (e as Error).message === 'map-image-failed' ? t('pdf.mapFailed') : (e as Error).message })); }
  finally { btn.disabled = false; }
});
$('xmlExport').addEventListener('click', async () => {
  if (!confirmDisclaimer()) return;
  const { exportIofXml } = await import('./core/iofxml');
  download(new Blob([exportIofXml(store.course, { ...state, desc })], { type: 'application/xml' }), `${fileBase()}.xml`);
  status(t('xml.saved'));
});
$('xmlImport').addEventListener('click', () => ($('xmlFile') as HTMLInputElement).click());
$('xmlFile').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement; const file = input.files?.[0]; input.value = '';
  if (!file) return;
  try {
    const { importIofXml } = await import('./core/iofxml');
    const r = importIofXml(await file.text());
    if (store.course.controls.length && !confirm(t('xml.replace'))) return;
    const s = r.setup ?? {};
    Object.assign(state, { ...(s.centre ? { centre: s.centre } : {}), ...(s.paper ? { paper: s.paper } : {}), ...(s.orientation ? { orientation: s.orientation } : {}), ...(s.scale ? { scale: s.scale } : {}), ...(s.marginMm !== undefined ? { marginMm: s.marginMm } : {}) });
    // keep automatic rotation unless the file carries a rotation that differs from the computed one
    const auto = northInfo(state.centre).magneticNorthGridBearingDeg;
    if (s.northGridBearingDeg !== undefined && Math.abs(s.northGridBearingDeg - auto) > 0.05) { state.autoRotation = false; state.manualRotation = s.northGridBearingDeg; }
    else state.autoRotation = true;
    ($('paper') as HTMLSelectElement).value = state.paper; ($('orientation') as HTMLSelectElement).value = state.orientation;
    ($('scale') as HTMLSelectElement).value = String(state.scale); ($('autoRot') as HTMLInputElement).checked = state.autoRotation;
    ($('firstNumber') as HTMLInputElement).value = String(r.course.firstNumber);
    if (s.desc) { Object.assign(desc, s.desc); ($('descInclude') as HTMLInputElement).checked = desc.include; ($('descCell') as HTMLSelectElement).value = String(desc.cellMm); }
    store.commit(r.course);
    update(); map.getView().setCenter([state.centre.e, state.centre.n]);
    status(r.warnings.length ? t('xml.importedWarn', { w: r.warnings.join(', ') }) : t('xml.imported'));
  } catch (err) { { const k = `xml.err.${(err as Error).message}`; status(t('xml.failed', { msg: dictHas(k) ? t(k as MessageKey) : (err as Error).message })); } }
});

// ---- language, help, first-run guide (US-30, US-32) ----
applyStatic();
const langSel = $('lang') as HTMLSelectElement; langSel.value = getLang();
langSel.addEventListener('change', () => { setLang(langSel.value as Lang); save(); location.reload(); });
const help = $('help') as HTMLDialogElement;
const openHelp = (): void => { if (!help.open) help.showModal(); };
$('helpBtn').addEventListener('click', openHelp);
$('aboutBtn').addEventListener('click', (e) => { e.preventDefault(); openHelp(); });
$('helpClose').addEventListener('click', () => help.close());
try { if (!localStorage.getItem('osm-korttelit:seenHelp')) { localStorage.setItem('osm-korttelit:seenHelp', '1'); openHelp(); } } catch { /* ignore */ }
$('dpi').addEventListener('change', updateWarnings);

// ---- offline (US-31): service worker + area prefetch + cache management ----
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(() => navigator.serviceWorker.ready).then(() => {
    try { if (!localStorage.getItem('osm-korttelit:offlineNotice')) { localStorage.setItem('osm-korttelit:offlineNotice', '1'); status(t('offline.ready')); } } catch { /* ignore */ }
  }).catch(() => undefined);
}
async function refreshUsage(): Promise<void> {
  try { const e = await navigator.storage?.estimate?.(); if (e?.usage !== undefined) $('usage').textContent = t('offline.usage', { mb: numberFormat(1).format(e.usage / 1048576) }); } catch { /* ignore */ }
}
void refreshUsage();
$('prefetch').addEventListener('click', async () => {
  const btn = $('prefetch') as HTMLButtonElement; btn.disabled = true;
  try {
    const { wmsUrl } = await import('./render/pdf');
    const { fetchOsm } = await import('./data/overpass');
    const dpi = Number(($('dpi') as HTMLSelectElement).value);
    const reqs = wmsRequests(state, dpi, 3990);
    let i = 0;
    for (const r of reqs) {
      status(t('offline.prefetching', { i: ++i, n: reqs.length + 1 }));
      const pad = 2 * (state.scale / 1000) * (25.4 / dpi);
      const b = { minE: r.bbox.minE - pad, maxE: r.bbox.maxE + pad, minN: r.bbox.minN - pad, maxN: r.bbox.maxN + pad };
      const res = await fetch(wmsUrl(b, r.width + 4, r.height + 4), { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await res.blob();
    }
    status(t('offline.prefetching', { i: reqs.length + 1, n: reqs.length + 1 }));
    await fetchOsm(frameBBox(state), { onStatus: () => undefined });
    status(t('offline.done'));
  } catch (e) { status(t('offline.failed', { msg: (e as Error).message })); }
  finally { btn.disabled = false; void refreshUsage(); }
});
$('clearCache').addEventListener('click', async () => {
  try {
    for (const k of await caches.keys()) await caches.delete(k);
    await new Promise<void>((res) => { const r = indexedDB.deleteDatabase('osm-korttelit'); r.onsuccess = r.onerror = r.onblocked = () => res(); });
    status(t('offline.cleared'));
  } catch { /* ignore */ }
  void refreshUsage();
});

// ---- automatic course generation ----
let cancelGen: (() => void) | null = null;
const syncLegDefaults = (): void => {
  const s = defaultSettings(state.scale, 1000);
  ($('genMin') as HTMLInputElement).value = String(s.minLegM); ($('genMax') as HTMLInputElement).value = String(s.maxLegM);
};
syncLegDefaults();
$('scale').addEventListener('change', syncLegDefaults);
$('showCands').addEventListener('change', (e) => setDebugPoints(null, (e.target as HTMLInputElement).checked));
$('gen').addEventListener('click', async () => {
  const btn = $('gen') as HTMLButtonElement;
  if (cancelGen) { cancelGen(); return; }
  const c = store.course;
  if (!c.start) { status(t('gen.needStart')); return; }
  const num = (id: string): number => Number(($(id) as HTMLInputElement).value);
  const seed = ($('genFixSeed') as HTMLInputElement).checked ? num('genSeed') : Math.floor(Math.random() * 1e6);
  const settings = { ...defaultSettings(state.scale, num('genDist'), seed), tolerance: Number(($('genTol') as HTMLSelectElement).value), minLegM: num('genMin'), maxLegM: num('genMax'), maxRatio: num('genRatio') };
  const locked = c.controls.some((k) => k.locked);
  const slots: Slot[] | undefined = locked ? c.controls.map((k) => (k.locked ? { locked: [k.pos.e, k.pos.n] as [number, number] } : {})) : undefined;
  const { runGeneration } = await import('./gen/client');
  const run = runGeneration({ setup: { ...state }, start: c.start.pos, finish: (c.finish ?? c.start).pos, settings, slots, allowForest: ($('genForest') as HTMLInputElement).checked, osmText: (window as unknown as { __osmOverride?: string }).__osmOverride }, status);
  cancelGen = () => { run.cancel(); };
  btn.textContent = t('gen.cancel');
  try {
    const r = await run.promise;
    const old = store.course.controls;
    store.commit({ ...store.course, controls: r.controls.map((k, i) => ({ id: locked && old[i]?.locked ? old[i]!.id : newControlId(), pos: k.pos, kind: k.kind, ...(k.dirGridDeg !== undefined ? { dirGridDeg: k.dirGridDeg } : {}), ...(k.locked ? { locked: true } : {}), ...(locked && old[i]?.locked && old[i]!.desc ? { desc: old[i]!.desc } : {}) })) });
    setDebugPoints(r.candidates);
    ($('genSeed') as HTMLInputElement).value = String(seed);
    const dev = r.metrics.deviation * 100;
    status(t('gen.done', { n: r.controls.length, len: numberFormat(0).format(r.metrics.crowFlyM), dev: `${dev >= 0 ? '+' : ''}${numberFormat(1).format(dev)}`, seed }) + (r.metrics.withinTolerance ? '' : t('gen.notWithin')));
  } catch (err) {
    const msg = (err as Error).message, code = msg.split(':')[0]!;
    status(dictHas(`err.${code}`) ? t(`err.${code}` as MessageKey) : t('gen.failed', { msg }));
  } finally { cancelGen = null; btn.textContent = t('gen.go'); }
});

update();
(window as unknown as { __app: unknown }).__app = { state, map, store };
