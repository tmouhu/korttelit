import { describe, expect, it } from 'vitest';
import { addControl, CourseStore, crowFlyLength, deletePoint, emptyCourse, legLengths, movePoint, reorderControl, sequence, setFinish, setStart } from './course';
import { buildCourseScene, autoLabelAngle, symbolSpecFor } from './symbols';
import type { PrintSetup } from './printFrame';

const setup: PrintSetup = { centre: { e: 0, n: 0 }, paper: 'A4', orientation: 'portrait', scale: 4000, marginMm: 10, northGridBearingDeg: 0 };

describe('course', () => {
  it('numbers controls from firstNumber and measures crow-fly length', () => {
    let c = setStart(emptyCourse(), { e: 0, n: 0 });
    c = addControl(c, { e: 300, n: 0 });
    c = addControl(c, { e: 300, n: 400 });
    c = setFinish(c, { e: 0, n: 400 });
    expect(sequence(c).map((s) => s.label)).toEqual([undefined, '1', '2', undefined]);
    expect(sequence(c).map((s) => s.code)).toEqual([undefined, '31', '32', undefined]);
    expect(legLengths(c)).toEqual([300, 400, 300]);
    expect(crowFlyLength(c)).toBe(1000);
  });
  it('inserts, reorders, deletes and renumbers', () => {
    let c = addControl(addControl(emptyCourse(), { e: 1, n: 1 }), { e: 3, n: 3 });
    c = addControl(c, { e: 2, n: 2 }, 1);
    expect(c.controls.map((k) => k.pos.e)).toEqual([1, 2, 3]);
    c = reorderControl(c, 0, 2);
    expect(c.controls.map((k) => k.pos.e)).toEqual([2, 3, 1]);
    c = deletePoint(c, { kind: 'control', id: c.controls[0]!.id });
    expect(sequence(c).map((s) => s.label)).toEqual(['1', '2']);
    expect(movePoint(c, { kind: 'start' }, { e: 1, n: 1 })).toBe(c);
  });
});

describe('store', () => {
  it('undo/redo and drag as one step', () => {
    const s = new CourseStore();
    s.commit(addControl(s.course, { e: 1, n: 1 }));
    const id = s.course.controls[0]!.id;
    s.begin();
    for (let i = 2; i < 12; i++) s.live(movePoint(s.course, { kind: 'control', id }, { e: i, n: i }));
    s.end();
    expect(s.course.controls[0]!.pos.e).toBe(11);
    s.undo(); expect(s.course.controls[0]!.pos.e).toBe(1);
    s.undo(); expect(s.course.controls.length).toBe(0);
    s.redo(); s.redo(); expect(s.course.controls[0]!.pos.e).toBe(11);
    expect(s.canRedo).toBe(false);
  });
  it('a begin/end with no change leaves no undo step', () => {
    const s = new CourseStore(); s.begin(); s.end(); expect(s.canUndo).toBe(false);
  });
});

describe('symbol scene', () => {
  it('legs are trimmed at circles; first control 400 m away is 100 mm at 1:4000', () => {
    let c = setStart(emptyCourse(), { e: 0, n: 0 });
    c = addControl(c, { e: 0, n: 400 });
    const spec = symbolSpecFor(4000);
    const items = buildCourseScene(c, setup, spec);
    const leg = items.find((i) => i.prim.kind === 'polyline' && !i.prim.closed)!.prim as Extract<typeof items[0]['prim'], { kind: 'polyline' }>;
    const len = Math.hypot(leg.pts[1]![0] - leg.pts[0]![0], leg.pts[1]![1] - leg.pts[0]![1]);
    expect(len).toBeCloseTo(100 - 7 / Math.sqrt(3) - spec.controlOuterDiameterMm / 2, 6);
    const tri = items.find((i) => i.ref === 'start')!.prim as Extract<typeof items[0]['prim'], { kind: 'polyline' }>;
    expect(tri.pts[0]![1]).toBeLessThan(0); // apex points up toward the control (north)
  });
  it('control number text is placed away from the leg and carries a narrow white halo', () => {
    let c = setStart(emptyCourse(), { e: 0, n: 0 });
    c = addControl(c, { e: 0, n: 400 });
    const txt = buildCourseScene(c, setup).find((i) => i.prim.kind === 'text')!.prim as Extract<ReturnType<typeof buildCourseScene>[0]['prim'], { kind: 'text' }>;
    expect(txt.text).toBe('1');
    expect(txt.haloMm).toBe(0.8);
    expect(Math.abs(txt.x)).toBeGreaterThan(3); // not on the vertical leg
  });
  it('auto label angle avoids incident legs', () => {
    expect(autoLabelAngle([225])).toBe(45);
    expect(autoLabelAngle([45])).not.toBe(45);
    expect(autoLabelAngle([])).toBe(45);
  });
});
