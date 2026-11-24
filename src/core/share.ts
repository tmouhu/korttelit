import { type Course, type Control, type DescColumn, newControlId } from './course';
import type { DescriptionSettings } from './descriptions';
import { normaliseScale, type Orientation, type PaperSize } from './printFrame';
import type { TM35 } from './projection';
import { CATALOGUE } from '../gen/catalogue';

/**
 * Share links (no backend): the whole map setup and course are encoded into the URL fragment
 * (`#share=…`). The fragment is never sent to a server. Links are untrusted input, so decoding validates everything.
 */
export interface ShareState {
  course: Course;
  setup: { centre: TM35; paper: PaperSize; orientation: Orientation; scale: number; marginMm: number; /** null = automatic (magnetic north up) */ rotation: number | null };
  desc: DescriptionSettings;
  north: { on: boolean; spacingMm: number };
  /** thin white outline under course lines */
  lineHalo: boolean;
}

export type ShareErrorCode = 'invalid' | 'unsupported' | 'too-large';
export class ShareError extends Error { constructor(public code: ShareErrorCode) { super(code); } }

export const SHARE_VERSION = 1;
export const SHARE_PARAM = 'share';
/** Longest accepted payload (characters) and decompressed size (bytes). */
export const MAX_PAYLOAD_CHARS = 60_000;
export const MAX_JSON_BYTES = 200_000;
const MAX_CONTROLS = 200;
const EXTENT = { minE: 41637, maxE: 754341, minN: 6580234, maxN: 7800842 }; // MapAnt coverage, EPSG:3067

// ---------------- wire format ----------------
type Pos = [number, number];
interface WireControl { p: Pos; k?: string; d?: number; l?: 1; a?: number; x?: Partial<Record<DescColumn, string>> }
interface Wire {
  v: number; n: string; f: number; s?: Pos; e?: Pos; c: WireControl[];
  m: { c: Pos; p: PaperSize; o: 'p' | 'l'; sc: number; mg: number; r: number | null };
  d: { i: 0 | 1; x: number; y: number; c: 5 | 6 | 7 };
  nl: { on: 0 | 1; sp: number };
  h?: 1;
}
const r1 = (v: number): number => Math.round(v * 10) / 10;
const pos = (p: TM35): Pos => [r1(p.e), r1(p.n)];

export function toWire(s: ShareState): Wire {
  const c = s.course;
  return {
    v: SHARE_VERSION, n: c.name, f: c.firstNumber,
    ...(c.start ? { s: pos(c.start.pos) } : {}), ...(c.finish ? { e: pos(c.finish.pos) } : {}),
    c: c.controls.map((k): WireControl => ({
      p: pos(k.pos),
      ...(k.kind ? { k: k.kind } : {}), ...(k.dirGridDeg !== undefined ? { d: r1(k.dirGridDeg) } : {}),
      ...(k.locked ? { l: 1 as const } : {}), ...(k.labelAngleDeg !== undefined ? { a: r1(k.labelAngleDeg) } : {}),
      ...(k.desc && Object.keys(k.desc).length ? { x: k.desc } : {}),
    })),
    m: { c: pos(s.setup.centre), p: s.setup.paper, o: s.setup.orientation === 'portrait' ? 'p' : 'l', sc: s.setup.scale, mg: s.setup.marginMm, r: s.setup.rotation === null ? null : r1(s.setup.rotation) },
    d: { i: s.desc.include ? 1 : 0, x: r1(s.desc.x), y: r1(s.desc.y), c: s.desc.cellMm },
    nl: { on: s.north.on ? 1 : 0, sp: s.north.spacingMm },
    ...(s.lineHalo ? { h: 1 as const } : {}),
  };
}

const bad = (): never => { throw new ShareError('invalid'); };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, min: number, max: number): number => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : bad());
const str = (v: unknown, max: number): string => (typeof v === 'string' && v.length <= max ? v : bad());
function pos2(v: unknown): TM35 {
  if (!Array.isArray(v) || v.length !== 2) return bad();
  return { e: num(v[0], EXTENT.minE, EXTENT.maxE), n: num(v[1], EXTENT.minN, EXTENT.maxN) };
}
const SYMBOL_ID = /^(\d{1,2}\.\d{1,2}[A-Za-z]{0,2})?$/;

/** Validate untrusted data and build a ShareState (fresh control ids; unknown feature kinds are dropped). */
export function fromWire(w: unknown): ShareState {
  if (!isObj(w)) return bad();
  if (w.v !== SHARE_VERSION) throw new ShareError(typeof w.v === 'number' && w.v > SHARE_VERSION ? 'unsupported' : 'invalid');
  if (!Array.isArray(w.c) || w.c.length > MAX_CONTROLS) return bad();
  const controls: Control[] = (w.c as unknown[]).map((raw): Control => {
    if (!isObj(raw)) return bad();
    const c: Control = { id: newControlId(), pos: pos2(raw.p) };
    if (raw.k !== undefined) { const k = str(raw.k, 40); if (CATALOGUE[k]) c.kind = k; }
    if (raw.d !== undefined) c.dirGridDeg = num(raw.d, 0, 360);
    if (raw.l === 1) c.locked = true;
    if (raw.a !== undefined) c.labelAngleDeg = num(raw.a, -360, 360);
    if (raw.x !== undefined) {
      if (!isObj(raw.x)) return bad();
      const desc: Partial<Record<DescColumn, string>> = {};
      for (const col of ['c', 'd', 'e', 'f', 'g', 'h'] as DescColumn[]) {
        if (raw.x[col] === undefined) continue;
        const sym = str(raw.x[col], 12);
        if (!SYMBOL_ID.test(sym)) return bad();
        desc[col] = sym;
      }
      if (Object.keys(desc).length) c.desc = desc;
    }
    return c;
  });
  const m = isObj(w.m) ? w.m : bad(), d = isObj(w.d) ? w.d : bad(), nl = isObj(w.nl) ? w.nl : bad();
  const p = m.p === 'A3' || m.p === 'A4' ? m.p : bad();
  const o = m.o === 'p' ? 'portrait' : m.o === 'l' ? 'landscape' : bad();
  const cell = d.c === 5 || d.c === 6 || d.c === 7 ? d.c : bad();
  const course: Course = {
    name: str(w.n, 60).trim() || 'Rata 1', controls, firstNumber: Math.round(num(w.f, 1, 9999)),
    ...(w.s !== undefined ? { start: { pos: pos2(w.s) } } : {}), ...(w.e !== undefined ? { finish: { pos: pos2(w.e) } } : {}),
  };
  return {
    course,
    setup: { centre: pos2(m.c), paper: p, orientation: o, scale: normaliseScale(num(m.sc, 1, 1e7)), marginMm: num(m.mg, 0, 30), rotation: m.r === null ? null : num(m.r, -180, 180) },
    desc: { include: d.i === 1, x: num(d.x, -1000, 1000), y: num(d.y, -1000, 1000), cellMm: cell },
    north: { on: nl.on === 1, spacingMm: num(nl.sp, 10, 100) },
    lineHalo: w.h === undefined ? false : w.h === 1 ? true : bad(),
  };
}

// ---------------- bytes ⇄ text ----------------
const toB64Url = (b: Uint8Array): string => { let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
function fromB64Url(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return bad();
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}
const hasCompression = (): boolean => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, cap?: number): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  void writer.write(bytes as unknown as BufferSource).then(() => writer.close()).catch(() => undefined);
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = []; let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (cap !== undefined && total > cap) { void reader.cancel(); throw new ShareError('too-large'); }
    chunks.push(value);
  }
  const out = new Uint8Array(total); let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

/** Payload = "z" + base64url(deflate-raw(json)) when compression exists, otherwise "r" + base64url(json). */
export async function encodeShare(s: ShareState): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(toWire(s)));
  if (hasCompression()) return 'z' + toB64Url(await pipe(json, new CompressionStream('deflate-raw')));
  return 'r' + toB64Url(json);
}

export async function decodeShare(payload: string): Promise<ShareState> {
  if (payload.length > MAX_PAYLOAD_CHARS) throw new ShareError('too-large');
  const kind = payload[0];
  if (kind !== 'z' && kind !== 'r') throw new ShareError('invalid');
  let bytes: Uint8Array;
  try { bytes = fromB64Url(payload.slice(1)); } catch (e) { throw e instanceof ShareError ? e : new ShareError('invalid'); }
  if (kind === 'z') {
    if (!hasCompression()) throw new ShareError('unsupported');
    try { bytes = await pipe(bytes, new DecompressionStream('deflate-raw'), MAX_JSON_BYTES); } catch (e) { throw e instanceof ShareError ? e : new ShareError('invalid'); }
  } else if (bytes.length > MAX_JSON_BYTES) throw new ShareError('too-large');
  let json: unknown;
  try { json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw new ShareError('invalid'); }
  return fromWire(json);
}

export function buildShareUrl(base: string, payload: string): string {
  const u = new URL(base); u.hash = `${SHARE_PARAM}=${payload}`; u.search = '';
  return u.toString();
}

/** Payload from a location hash like "#share=…", or null. */
export function payloadFromHash(hash: string): string | null {
  const m = /^#share=([A-Za-z0-9_-]+)$/.exec(hash);
  return m ? m[1]! : null;
}
