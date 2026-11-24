import { describe, expect, it } from 'vitest';
import { emptyCourse, type Course } from './course';
import { assignSpecial, buildDescriptions, compass } from './descriptions';

const mk = (controls: Course['controls']): Course => ({ ...emptyCourse(), controls });
const c = (kind: string, extra: Partial<Course['controls'][0]> = {}) => ({ id: kind + Math.random(), pos: { e: 0, n: 0 }, kind, ...extra });

describe('compass', () => {
  it('maps bearings to 8 points', () => {
    expect([0, 44, 46, 90, 180, 225, 270, 359].map(compass)).toEqual(['N', 'NE', 'NE', 'E', 'S', 'SW', 'W', 'N']);
  });
});

describe('automatic descriptions', () => {
  it('maps catalogue kinds to IOF symbols', () => {
    const d = buildDescriptions(mk([c('bridge'), c('boulder'), c('statue'), c('path_junction')]), 0);
    expect(d.lines.map((l) => l.row)).toEqual([{ d: '5.4' }, { d: '2.4' }, { d: '5.20' }, { d: '5.2', f: '10.2' }]);
    expect(d.lines.map((l) => l.code)).toEqual(['31', '32', '33', '34']);
  });
  it('corner direction is relative to the sheet orientation (magnetic north up)', () => {
    // corner points to grid bearing 90° (east). With the sheet rotated by 12°, it points to map bearing 78° → E.
    const d = buildDescriptions(mk([c('building_corner', { dirGridDeg: 90 })]), 12);
    expect(d.lines[0]!.row).toEqual({ d: '5.11', g: '11.5E' });
    // grid bearing 30° and sheet rotated 12° → 18° → N
    expect(buildDescriptions(mk([c('building_corner', { dirGridDeg: 30 })]), 12).lines[0]!.row.g).toBe('11.5N');
    // 60 − 12 = 48° → NE
    expect(buildDescriptions(mk([c('fence_corner', { dirGridDeg: 60 })]), 12).lines[0]!.row).toEqual({ d: '5.9', g: '11.5NE' });
  });
  it('special items: only two symbols exist, extra kinds are reported', () => {
    const cs = [c('bench'), c('flagpole'), c('bench'), c('bus_stop')];
    const sp = assignSpecial(cs);
    expect(sp.legend).toEqual([{ symbol: '6.1', kind: 'bench' }, { symbol: '6.2', kind: 'flagpole' }]);
    expect(sp.unresolved).toEqual(['bus_stop']);
    const d = buildDescriptions(mk(cs), 0);
    expect(d.lines.map((l) => l.row.d)).toEqual(['6.1', '6.2', '6.1', undefined]);
  });
  it('manual overrides win over automatic; empty string blanks a cell', () => {
    const d = buildDescriptions(mk([c('building_corner', { dirGridDeg: 90, desc: { d: '5.12', g: '' } })]), 0);
    expect(d.lines[0]!.row).toEqual({ d: '5.12' });
    expect(d.lines[0]!.auto).toEqual({ d: '5.11', g: '11.5E' });
  });
  it('manually placed controls get an empty row', () => {
    expect(buildDescriptions(mk([{ id: 'x', pos: { e: 0, n: 0 } }]), 0).lines[0]!.row).toEqual({});
  });
});

import { sheetSize } from '../render/descriptionSheet';
describe('description sheet size', () => {
  it('has no title row: length + start + controls + finish rows', () => {
    expect(sheetSize(6, 6)).toEqual({ w: 48, h: 54 }); // (3 + 6) rows × 6 mm
  });
});
