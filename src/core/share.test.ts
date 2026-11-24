import { describe, expect, it } from 'vitest';
import { addControl, emptyCourse, setFinish, setStart, type Course } from './course';
import { buildShareUrl, decodeShare, encodeShare, fromWire, payloadFromHash, ShareError, toWire, type ShareState } from './share';

const sample = (): ShareState => {
  let c: Course = { ...emptyCourse('Talviharjoitus 1'), firstNumber: 41 };
  c = setStart(c, { e: 385361.3, n: 6671818.4 });
  for (let i = 0; i < 12; i++) c = addControl(c, { e: 385400 + i * 53.17, n: 6671900 + (i % 3) * 77.31 });
  c = setFinish(c, { e: 385800.5, n: 6672300.2 });
  c.controls[0] = { ...c.controls[0]!, kind: 'building_corner', dirGridDeg: 135.55, locked: true, desc: { d: '5.12', g: '' } };
  c.controls[1] = { ...c.controls[1]!, labelAngleDeg: 200, kind: 'path_junction' };
  return { course: c, setup: { centre: { e: 385611.3, n: 6672118.4 }, paper: 'A3', orientation: 'landscape', scale: 7300, marginMm: 10, rotation: null }, desc: { include: true, x: -92, y: -135.5, cellMm: 7 }, north: { on: true, spacingMm: 40 }, lineHalo: true };
};
const round1 = (v: number): number => Math.round(v * 10) / 10;

describe('share links', () => {
  it('round-trips the whole state (positions to 0.1 m, fresh ids)', async () => {
    const s = sample();
    const back = await decodeShare(await encodeShare(s));
    expect(back.course.name).toBe('Talviharjoitus 1');
    expect(back.course.firstNumber).toBe(41);
    expect(back.course.start!.pos).toEqual({ e: round1(s.course.start!.pos.e), n: round1(s.course.start!.pos.n) });
    expect(back.course.finish!.pos.e).toBeCloseTo(385800.5, 6);
    expect(back.course.controls).toHaveLength(12);
    back.course.controls.forEach((k, i) => { expect(Math.abs(k.pos.e - s.course.controls[i]!.pos.e)).toBeLessThan(0.051); expect(Math.abs(k.pos.n - s.course.controls[i]!.pos.n)).toBeLessThan(0.051); });
    expect(back.course.controls[0]).toMatchObject({ kind: 'building_corner', dirGridDeg: 135.6, locked: true, desc: { d: '5.12', g: '' } });
    expect(back.course.controls[1]).toMatchObject({ labelAngleDeg: 200, kind: 'path_junction' });
    expect(new Set(back.course.controls.map((k) => k.id)).size).toBe(12);
    expect(back.setup).toEqual({ centre: { e: 385611.3, n: 6672118.4 }, paper: 'A3', orientation: 'landscape', scale: 7300, marginMm: 10, rotation: null });
    expect(back.desc).toEqual(s.desc);
    expect(back.north).toEqual(s.north);
    expect(back.lineHalo).toBe(true);
  });
  it('treats a missing halo flag as off (older links) and rejects bad values', () => {
    const w = toWire({ ...sample(), lineHalo: false }) as unknown as Record<string, any>;
    expect(w.h).toBeUndefined();
    expect(fromWire(w).lineHalo).toBe(false);
    expect(() => fromWire({ ...w, h: 'yes' })).toThrow(ShareError);
  });
  it('keeps a typical course short enough for a link (12 controls < 1500 characters)', async () => {
    expect((await encodeShare(sample())).length).toBeLessThan(1500);
  });
  it('builds and parses URLs', async () => {
    const p = await encodeShare(sample());
    const url = buildShareUrl('https://tmouhu.github.io/korttelit/?x=1#old', p);
    expect(url.startsWith('https://tmouhu.github.io/korttelit/#share=')).toBe(true);
    expect(payloadFromHash(new URL(url).hash)).toBe(p);
    expect(payloadFromHash('#other=1')).toBeNull();
    expect(payloadFromHash('#share=a b')).toBeNull();
  });
  it('rejects garbage, wrong types and out-of-range values', async () => {
    const w = toWire(sample()) as unknown as Record<string, any>;
    const mut = (f: (x: Record<string, any>) => void): unknown => { const c = JSON.parse(JSON.stringify(w)); f(c); return c; };
    for (const broken of [
      null, [], 'x', {}, mut((x) => { x.n = 5; }), mut((x) => { x.n = 'a'.repeat(61); }),
      mut((x) => { x.c[0].p = [1, 2]; }), mut((x) => { x.c[0].p = ['a', 'b']; }), mut((x) => { x.s = [385000, 1e9]; }),
      mut((x) => { x.m.p = 'A0'; }), mut((x) => { x.m.o = 'x'; }), mut((x) => { x.d.c = 9; }), mut((x) => { x.f = 0; }),
      mut((x) => { x.c[0].x = { d: '<img onerror=alert(1)>' }; }), mut((x) => { x.c = new Array(201).fill(x.c[0]); }), mut((x) => { x.nl.sp = 500; }),
      mut((x) => { x.m.c = [NaN, 6670000]; }),
    ]) expect(() => fromWire(broken)).toThrow(ShareError);
  });
  it('reports newer versions and bad payloads with distinct codes', async () => {
    expect(() => fromWire({ v: 2 })).toThrowError(expect.objectContaining({ code: 'unsupported' }));
    await expect(decodeShare('zzzz')).rejects.toMatchObject({ code: 'invalid' });
    await expect(decodeShare('q123')).rejects.toMatchObject({ code: 'invalid' });
    await expect(decodeShare('r' + btoa('{"v":1').replace(/=/g, ''))).rejects.toMatchObject({ code: 'invalid' });
    await expect(decodeShare('r!!!')).rejects.toMatchObject({ code: 'invalid' });
    await expect(decodeShare('z' + 'A'.repeat(70_000))).rejects.toMatchObject({ code: 'too-large' });
  });
  it('refuses decompression bombs', async () => {
    const bomb = new Uint8Array(5_000_000).fill(32); // 5 MB of spaces compresses to a few KB
    const cs = new CompressionStream('deflate-raw'); const wr = cs.writable.getWriter(); void wr.write(bomb).then(() => wr.close());
    const parts: Uint8Array[] = []; const rd = cs.readable.getReader(); for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); }
    let s = ''; for (const p of parts) for (const b of p) s += String.fromCharCode(b);
    const payload = 'z' + btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(payload.length).toBeLessThan(60_000);
    await expect(decodeShare(payload)).rejects.toMatchObject({ code: 'too-large' });
  });
  it('normalises odd scales and drops unknown feature kinds', async () => {
    const w = toWire(sample()) as unknown as Record<string, any>; w.m.sc = 7350; w.c[1].k = 'not_a_kind';
    const s = fromWire(w);
    expect(s.setup.scale).toBe(7400);
    expect(s.course.controls[1]!.kind).toBeUndefined();
  });
});
