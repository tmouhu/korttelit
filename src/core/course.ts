import type { TM35 } from './projection';

export interface Control {
  id: string; pos: TM35;
  /** Manual label direction, degrees clockwise from paper-up. Auto when undefined. */
  labelAngleDeg?: number;
  /** Feature type from the control catalogue (set by the generator), e.g. 'building_corner'. */
  kind?: string;
  /** Kept in place when the course is regenerated. */
  locked?: boolean;
  /** For corner-type features: grid bearing (deg, clockwise from grid north) the corner points to. */
  dirGridDeg?: number;
  /** Manual overrides of the control description; '' = deliberately blank. */
  desc?: Partial<Record<DescColumn, string>>;
}
export type DescColumn = 'c' | 'd' | 'e' | 'f' | 'g' | 'h';
export interface Course {
  name: string;
  start?: { pos: TM35 };
  controls: Control[];
  finish?: { pos: TM35 };
  /** Control code of the first control (default 31); codes are shown on the description sheet and in IOF XML. */
  firstNumber: number;
}

export const emptyCourse = (name = 'Rata 1'): Course => ({ name, controls: [], firstNumber: 31 });

let counter = 0;
export const newControlId = (): string => `c${Date.now().toString(36)}${(counter++).toString(36)}`;

export type PointRef = { kind: 'start' } | { kind: 'finish' } | { kind: 'control'; id: string };

export function setStart(c: Course, pos: TM35): Course { return { ...c, start: { pos } }; }
export function setFinish(c: Course, pos: TM35): Course { return { ...c, finish: { pos } }; }

/** Insert a control at index (default: end). */
export function addControl(c: Course, pos: TM35, index = c.controls.length): Course {
  const controls = c.controls.slice();
  controls.splice(Math.max(0, Math.min(index, controls.length)), 0, { id: newControlId(), pos });
  return { ...c, controls };
}

export function movePoint(c: Course, ref: PointRef, pos: TM35): Course {
  if (ref.kind === 'start') return c.start ? { ...c, start: { pos } } : c;
  if (ref.kind === 'finish') return c.finish ? { ...c, finish: { pos } } : c;
  return { ...c, controls: c.controls.map((k) => (k.id === ref.id ? { ...k, pos } : k)) };
}

export function deletePoint(c: Course, ref: PointRef): Course {
  if (ref.kind === 'start') { const { start: _s, ...rest } = c; return rest; }
  if (ref.kind === 'finish') { const { finish: _f, ...rest } = c; return rest; }
  return { ...c, controls: c.controls.filter((k) => k.id !== ref.id) };
}

export function reorderControl(c: Course, from: number, to: number): Course {
  if (from === to || from < 0 || from >= c.controls.length || to < 0 || to >= c.controls.length) return c;
  const controls = c.controls.slice();
  const [m] = controls.splice(from, 1);
  controls.splice(to, 0, m!);
  return { ...c, controls };
}

export function setLabelAngle(c: Course, id: string, deg: number | undefined): Course {
  return { ...c, controls: c.controls.map((k) => (k.id === id ? { ...k, labelAngleDeg: deg } : k)) };
}

/** Ordered course points: start, controls, finish (those that exist). */
/** `label` = sequence number shown on the map (1, 2, 3…); `code` = control code (flag number), counted from firstNumber. */
export function sequence(c: Course): { ref: PointRef; pos: TM35; label?: string; code?: string }[] {
  const out: { ref: PointRef; pos: TM35; label?: string; code?: string }[] = [];
  if (c.start) out.push({ ref: { kind: 'start' }, pos: c.start.pos });
  c.controls.forEach((k, i) => out.push({ ref: { kind: 'control', id: k.id }, pos: k.pos, label: String(i + 1), code: String(c.firstNumber + i) }));
  if (c.finish) out.push({ ref: { kind: 'finish' }, pos: c.finish.pos });
  return out;
}

export const dist = (a: TM35, b: TM35): number => Math.hypot(a.e - b.e, a.n - b.n);

export function legLengths(c: Course): number[] {
  const s = sequence(c);
  return s.slice(1).map((p, i) => dist(s[i]!.pos, p.pos));
}

/** Crow-fly course length in metres. */
export const crowFlyLength = (c: Course): number => legLengths(c).reduce((a, b) => a + b, 0);

/** Undo/redo history around an immutable Course. */
export class CourseStore {
  private undoStack: Course[] = [];
  private redoStack: Course[] = [];
  private listeners = new Set<() => void>();
  constructor(public course: Course = emptyCourse()) {}

  subscribe(fn: () => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit(): void { this.listeners.forEach((f) => f()); }

  /** Apply a change as one undo step. */
  commit(next: Course): void {
    if (next === this.course) return;
    this.undoStack.push(this.course); this.redoStack = [];
    if (this.undoStack.length > 200) this.undoStack.shift();
    this.course = next; this.emit();
  }
  /** Start a continuous edit (drag): records one undo step, later `live()` updates don't. */
  begin(): void { this.undoStack.push(this.course); this.redoStack = []; }
  live(next: Course): void { this.course = next; this.emit(); }
  /** Drop the step recorded by begin() if nothing changed. */
  end(): void {
    if (this.undoStack[this.undoStack.length - 1] === this.course) this.undoStack.pop();
    this.emit();
  }
  undo(): void { const p = this.undoStack.pop(); if (!p) return; this.redoStack.push(this.course); this.course = p; this.emit(); }
  redo(): void { const n = this.redoStack.pop(); if (!n) return; this.undoStack.push(this.course); this.course = n; this.emit(); }
  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }
}
