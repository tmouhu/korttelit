// @vitest-environment jsdom
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { addControl, emptyCourse, setFinish, setLabelAngle, setStart, dist } from './course';
import { exportIofXml, importIofXml, IofImportError, type SetupData } from './iofxml';
import { lonLatToTM35 } from './projection';

const hki = lonLatToTM35({ lon: 24.9384, lat: 60.1699 });
const setup: SetupData = { centre: hki, paper: 'A4', orientation: 'portrait', scale: 4000, marginMm: 10, northGridBearingDeg: 12.3, desc: { include: true, x: -40, y: 12.5, cellMm: 7 } };
const sample = () => {
  let c = { ...emptyCourse(), name: 'Testi & <rata>' };
  c = setStart(c, { e: hki.e - 100, n: hki.n - 200 });
  c = addControl(c, { e: hki.e + 50, n: hki.n });
  c = addControl(c, { e: hki.e + 150, n: hki.n + 250 });
  c = setLabelAngle(c, c.controls[1]!.id, 200);
  c = { ...c, controls: c.controls.map((k, i) => (i === 0 ? { ...k, kind: 'building_corner', dirGridDeg: 135.5, locked: true, desc: { d: '5.12', g: '' } } : k)) };
  return setFinish(c, { e: hki.e - 80, n: hki.n + 300 });
};

describe('IOF XML 3.0', () => {
  it('round-trips controls (≤0.1 m), order, setup and label angle', () => {
    const c = sample();
    const xml = exportIofXml(c, setup);
    if (process.env.XML_OUT) writeFileSync(process.env.XML_OUT, xml);
    const r = importIofXml(xml);
    expect(r.warnings).toEqual([]);
    expect(r.course.name).toBe('Testi & <rata>');
    expect(r.course.controls).toHaveLength(2);
    r.course.controls.forEach((k, i) => expect(dist(k.pos, c.controls[i]!.pos)).toBeLessThan(0.1));
    expect(dist(r.course.start!.pos, c.start!.pos)).toBeLessThan(0.1);
    expect(dist(r.course.finish!.pos, c.finish!.pos)).toBeLessThan(0.1);
    expect(r.course.controls[1]!.labelAngleDeg).toBe(200);
    expect(r.course.controls[0]).toMatchObject({ kind: 'building_corner', dirGridDeg: 135.5, locked: true, desc: { d: '5.12', g: '' } });
    expect(r.setup!.desc).toEqual({ include: true, x: -40, y: 12.5, cellMm: 7 });
    expect(r.setup).toMatchObject({ paper: 'A4', orientation: 'portrait', scale: 4000, marginMm: 10 });
    expect(r.setup!.northGridBearingDeg).toBeCloseTo(12.3, 3);
  });
  it('imports a plain IOF file without app extension (e.g. from other tools), centring on the course', () => {
    const xml = exportIofXml(sample(), setup).replace(/<Extensions>[\s\S]*<\/Extensions>\n/, '');
    const r = importIofXml(xml);
    expect(r.course.controls).toHaveLength(2);
    expect(r.setup!.scale).toBe(4000);
    expect(r.setup!.centre).toBeDefined();
  });
  it('reports clear errors', () => {
    expect(() => importIofXml('<nope')).toThrow(IofImportError);
    expect(() => importIofXml('<ResultList xmlns="x"/>')).toThrow('not-coursedata');
    const noGeo = exportIofXml(sample(), setup).replace(/<Position [^>]*\/>/g, '');
    expect(() => importIofXml(noGeo)).toThrow('no-geographic-positions');
  });
});
