/// <reference lib="webworker" />
import { frameBBox, mapAreaMm, groundToPaper, type PrintSetup } from '../core/printFrame';
import { generateCourse, GenError, type GenSettings, type Slot } from './generator';
import { parseOverpass } from './osm';
import { buildWorld, type World } from './world';
import type { XY } from './geom';

export interface WorkerRequest {
  type: 'generate';
  key: string;
  /** raw Overpass JSON; omitted when the worker already holds the data for `key` */
  osmText?: string;
  setup: PrintSetup;
  start: XY; finish: XY;
  settings: GenSettings;
  slots?: Slot[];
  allowForest: boolean;
}
export type WorkerResponse =
  | { type: 'status'; message: string }
  | { type: 'need-data' }
  | { type: 'result'; controls: { pos: XY; kind: string; locked?: boolean; dir?: number }[]; metrics: unknown; stats: World['stats']; candidates: [number, number, string][] }
  | { type: 'error'; code: string };

let cached: { key: string; allowForest: boolean; maxCost: number; world: World } | null = null;
let osmCache: { key: string; text: string } | null = null;
const post = (m: WorkerResponse): void => (self as unknown as Worker).postMessage(m);

self.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const m = ev.data;
  try {
    if (m.osmText) osmCache = { key: m.key, text: m.osmText };
    if (!osmCache || osmCache.key !== m.key) { post({ type: 'need-data' }); return; }
    const maxCost = Math.ceil(m.settings.maxLegM * m.settings.maxRatio + 150);
    if (!cached || cached.key !== m.key || cached.allowForest !== m.allowForest || cached.maxCost !== maxCost) {
      post({ type: 'status', message: 'status.processing' });
      const world = buildWorld(parseOverpass(osmCache.text), { allowForest: m.allowForest, maxRouteCost: maxCost });
      cached = { key: m.key, allowForest: m.allowForest, maxCost, world };
    }
    const world = cached.world;
    const area = mapAreaMm(m.setup);
    // keep symbols (circle + number) fully inside the map area
    const inFrame = (p: XY): boolean => { const q = groundToPaper(m.setup, { e: p[0], n: p[1] }); return Math.abs(q.x) < area.w / 2 - 6 && Math.abs(q.y) < area.h / 2 - 6; };
    void frameBBox;
    post({ type: 'status', message: 'status.generating' });
    const r = generateCourse({ world, start: m.start, finish: m.finish, settings: m.settings, inFrame, slots: m.slots });
    post({
      type: 'result', controls: r.controls.map((c) => ({ pos: c.pos, kind: c.kind, locked: c.locked, dir: c.dir })), metrics: r.metrics, stats: world.stats,
      candidates: world.candidates.filter((c) => inFrame(c.pos)).map((c) => [c.pos[0], c.pos[1], c.kind] as [number, number, string]),
    });
  } catch (e) {
    post({ type: 'error', code: e instanceof GenError ? e.message : `internal: ${(e as Error).message}` });
  }
};
