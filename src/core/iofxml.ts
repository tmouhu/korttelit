import type { DescriptionSettings } from './descriptions';
import { type Course, type Control, type DescColumn, crowFlyLength, newControlId, sequence } from './course';
import { groundToPaper, mapAreaMm, type PrintSetup, type PaperSize, type Orientation } from './printFrame';
import { lonLatToTM35, tm35ToLonLat, type TM35 } from './projection';

const IOF_NS = 'http://www.orienteering.org/datastandard/3.0';
const APP_NS = 'urn:osm-korttelit:1';
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f = (n: number, d = 6): string => String(Number(n.toFixed(d)));

/** Map/print setup as stored in the file's app extension. */
export type SetupData = Pick<PrintSetup, 'centre' | 'paper' | 'orientation' | 'scale' | 'marginMm' | 'northGridBearingDeg'> & { desc?: DescriptionSettings };

export function exportIofXml(course: Course, setup: SetupData, now = new Date()): string {
  const s = setup as PrintSetup;
  const seq = sequence(course);
  const area = mapAreaMm(s);
  const idOf = (r: (typeof seq)[number]['ref'], code?: string): string => (r.kind === 'start' ? 'S1' : r.kind === 'finish' ? 'F1' : code!);
  const typeOf = (k: string): string => (k === 'start' ? 'Start' : k === 'finish' ? 'Finish' : 'Control');

  const controls = seq.map((p) => {
    const ll = tm35ToLonLat(p.pos);
    const mp = groundToPaper(s, p.pos);
    return `    <Control type="${typeOf(p.ref.kind)}">
      <Id>${esc(idOf(p.ref, p.code))}</Id>
      <Position lng="${f(ll.lon, 7)}" lat="${f(ll.lat, 7)}"/>
      <MapPosition x="${f(mp.x, 3)}" y="${f(mp.y, 3)}" unit="mm"/>
    </Control>`;
  });
  const courseControls = seq.map((p) => `      <CourseControl type="${typeOf(p.ref.kind)}">
        <Control>${esc(idOf(p.ref, p.code))}</Control>
      </CourseControl>`);
  // app-specific per-control data (feature type, corner direction, lock, label angle, description overrides)
  const labelAngles = course.controls.map((c, i) => {
    const attrs = [
      c.labelAngleDeg !== undefined ? ` angle="${f(c.labelAngleDeg, 2)}"` : '', c.kind ? ` kind="${esc(c.kind)}"` : '',
      c.dirGridDeg !== undefined ? ` dir="${f(c.dirGridDeg, 2)}"` : '', c.locked ? ' locked="1"' : '',
      ...(['c', 'd', 'e', 'f', 'g', 'h'] as DescColumn[]).map((col) => (c.desc?.[col] !== undefined ? ` desc-${col}="${esc(c.desc[col]!)}"` : '')),
    ].join('');
    return attrs ? `<osmk:Label control="${i}"${attrs}/>` : '';
  }).join('');
  const d = setup.desc;
  const descAttrs = d ? ` descInclude="${d.include ? 1 : 0}" descX="${f(d.x, 2)}" descY="${f(d.y, 2)}" descCell="${d.cellMm}"` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<CourseData xmlns="${IOF_NS}" xmlns:osmk="${APP_NS}" iofVersion="3.0" createTime="${now.toISOString().replace(/\.\d+Z$/, 'Z')}" creator="osm-korttelit">
  <Event>
    <Name>${esc(course.name)}</Name>
  </Event>
  <RaceCourseData>
    <Map>
      <Scale>${setup.scale}</Scale>
      <MapPositionTopLeft x="${f(-area.w / 2, 3)}" y="${f(-area.h / 2, 3)}" unit="mm"/>
      <MapPositionBottomRight x="${f(area.w / 2, 3)}" y="${f(area.h / 2, 3)}" unit="mm"/>
    </Map>
${controls.join('\n')}
    <Course>
      <Name>${esc(course.name)}</Name>
      <Length>${f(crowFlyLength(course), 1)}</Length>
${courseControls.join('\n')}
    </Course>
  </RaceCourseData>
  <Extensions>
    <osmk:Setup centreE="${f(setup.centre.e, 2)}" centreN="${f(setup.centre.n, 2)}" paper="${setup.paper}" orientation="${setup.orientation}" scale="${setup.scale}" marginMm="${setup.marginMm}" northGridBearingDeg="${f(setup.northGridBearingDeg, 4)}" firstNumber="${course.firstNumber}"${descAttrs}>${labelAngles}</osmk:Setup>
  </Extensions>
</CourseData>
`;
}

export interface ImportResult { course: Course; setup?: Partial<SetupData>; warnings: string[] }

export class IofImportError extends Error {}

const kids = (el: Element, name: string): Element[] => Array.from(el.children).filter((c) => c.localName === name);
const kid = (el: Element, name: string): Element | undefined => kids(el, name)[0];

/** Parse IOF XML 3.0 CourseData. Uses geographic Position (WGS84); throws IofImportError when unusable. */
export function importIofXml(text: string): ImportResult {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new IofImportError('invalid-xml');
  const root = doc.documentElement;
  if (root.localName !== 'CourseData') throw new IofImportError('not-coursedata');
  const rcd = kid(root, 'RaceCourseData');
  if (!rcd) throw new IofImportError('no-race-course-data');
  const warnings: string[] = [];

  const byId = new Map<string, { pos?: TM35; type: string }>();
  let missingPos = 0;
  for (const c of kids(rcd, 'Control')) {
    const id = kid(c, 'Id')?.textContent?.trim();
    if (!id) continue;
    const p = kid(c, 'Position');
    let pos: TM35 | undefined;
    if (p) {
      const lng = Number(p.getAttribute('lng')), lat = Number(p.getAttribute('lat'));
      if (Number.isFinite(lng) && Number.isFinite(lat)) pos = lonLatToTM35({ lon: lng, lat });
    }
    if (!pos) missingPos++;
    byId.set(id, { pos, type: c.getAttribute('type') ?? 'Control' });
  }
  const courseEl = kid(rcd, 'Course');
  if (!courseEl) throw new IofImportError('no-course');
  if (kids(rcd, 'Course').length > 1) warnings.push('multiple-courses-first-used');
  if (missingPos) throw new IofImportError('no-geographic-positions');

  const course: Course = { name: kid(courseEl, 'Name')?.textContent?.trim() || kid(root, 'Event')?.getElementsByTagName('Name')[0]?.textContent?.trim() || 'Rata 1', controls: [], firstNumber: 31 };
  const controls: Control[] = [];
  let firstNumber: number | undefined;
  for (const cc of kids(courseEl, 'CourseControl')) {
    const refs = kids(cc, 'Control');
    if (refs.length > 1) warnings.push('control-variations-first-used');
    const id = refs[0]?.textContent?.trim() ?? '';
    const c = byId.get(id);
    if (!c?.pos) { warnings.push(`unknown-control:${id}`); continue; }
    const type = cc.getAttribute('type') ?? c.type;
    if (type === 'Start') course.start = { pos: c.pos };
    else if (type === 'Finish') course.finish = { pos: c.pos };
    else if (type === 'Control') {
      if (firstNumber === undefined && /^\d+$/.test(id)) firstNumber = Number(id);
      controls.push({ id: newControlId(), pos: c.pos });
    } else warnings.push(`skipped-type:${type}`);
  }
  course.controls = controls;
  if (firstNumber !== undefined) course.firstNumber = firstNumber;

  // app extension
  let setup: Partial<SetupData> | undefined;
  const ext = Array.from(root.children).find((c) => c.localName === 'Extensions');
  const el = ext && Array.from(ext.children).find((c) => c.namespaceURI === APP_NS && c.localName === 'Setup');
  if (el) {
    const n = (k: string): number | undefined => { const v = el.getAttribute(k); return v === null || v === '' ? undefined : Number(v); };
    const e = n('centreE'), nn = n('centreN');
    setup = {
      ...(e !== undefined && nn !== undefined && Number.isFinite(e) && Number.isFinite(nn) ? { centre: { e, n: nn } } : {}),
      ...(el.getAttribute('paper') === 'A3' || el.getAttribute('paper') === 'A4' ? { paper: el.getAttribute('paper') as PaperSize } : {}),
      ...(el.getAttribute('orientation') === 'portrait' || el.getAttribute('orientation') === 'landscape' ? { orientation: el.getAttribute('orientation') as Orientation } : {}),
      ...(n('scale') ? { scale: n('scale')! } : {}),
      ...(n('marginMm') !== undefined ? { marginMm: n('marginMm')! } : {}),
      ...(n('northGridBearingDeg') !== undefined ? { northGridBearingDeg: n('northGridBearingDeg')! } : {}),
    };
    const fn = n('firstNumber'); if (fn) course.firstNumber = fn;
    if (el.getAttribute('descInclude') !== null) {
      const cell = n('descCell');
      setup = { ...setup, desc: { include: el.getAttribute('descInclude') === '1', x: n('descX') ?? 0, y: n('descY') ?? 0, cellMm: cell === 5 || cell === 7 ? cell : 6 } };
    }
    for (const l of Array.from(el.children).filter((c) => c.localName === 'Label')) {
      const i = Number(l.getAttribute('control')), ctl = course.controls[i];
      if (!ctl) continue;
      const a = l.getAttribute('angle'); if (a !== null && Number.isFinite(Number(a))) ctl.labelAngleDeg = Number(a);
      const kind = l.getAttribute('kind'); if (kind) ctl.kind = kind;
      const dir = l.getAttribute('dir'); if (dir !== null && Number.isFinite(Number(dir))) ctl.dirGridDeg = Number(dir);
      if (l.getAttribute('locked') === '1') ctl.locked = true;
      for (const col of ['c', 'd', 'e', 'f', 'g', 'h'] as DescColumn[]) { const v = l.getAttribute(`desc-${col}`); if (v !== null) (ctl.desc ??= {})[col] = v; }
    }
  } else {
    // No app data: scale from the file's Map if present; centre on the course.
    const sc = Number(kid(kid(rcd, 'Map') ?? rcd, 'Scale')?.textContent);
    const pts = sequence(course).map((p) => p.pos);
    setup = {
      ...(Number.isFinite(sc) && sc > 0 ? { scale: sc } : {}),
      ...(pts.length ? { centre: { e: (Math.min(...pts.map((p) => p.e)) + Math.max(...pts.map((p) => p.e))) / 2, n: (Math.min(...pts.map((p) => p.n)) + Math.max(...pts.map((p) => p.n))) / 2 } } : {}),
    };
  }
  return { course, setup, warnings };
}
