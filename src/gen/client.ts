import { t, type MessageKey } from '../i18n';
import { frameBBox, type PrintSetup } from '../core/printFrame';
import type { TM35 } from '../core/projection';
import { fetchOsm } from '../data/overpass';
import type { GenSettings, GenResult, Slot } from './generator';
import type { WorkerRequest, WorkerResponse } from './worker';
import type { World } from './world';

export interface ClientRequest { setup: PrintSetup; start: TM35; finish: TM35; settings: GenSettings; slots?: Slot[]; allowForest: boolean;
  /** Use this Overpass JSON instead of fetching (offline use, tests). */
  osmText?: string }
export interface ClientResult {
  controls: { pos: TM35; kind: string; locked?: boolean; dirGridDeg?: number }[];
  metrics: GenResult['metrics']; stats: World['stats']; candidates: [number, number, string][];
}

const osmMemory = new Map<string, string>();

/** Runs generation off the main thread. Data is fetched on the main thread (Overpass), processing happens in a Web Worker. */
export function runGeneration(req: ClientRequest, onStatus: (m: string) => void): { promise: Promise<ClientResult>; cancel: () => void } {
  const abort = new AbortController();
  let worker: Worker | null = null;
  const cancel = (): void => { abort.abort(); worker?.terminate(); worker = null; };
  const promise = (async (): Promise<ClientResult> => {
    const b = frameBBox(req.setup);
    const key = [b.minE, b.minN, b.maxE, b.maxN].map((v) => Math.round(v)).join(',');
    let text = req.osmText ?? osmMemory.get(key);
    if (!text) { text = await fetchOsm(b, { onStatus, signal: abort.signal }); osmMemory.clear(); osmMemory.set(key, text); }
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    const w = worker;
    return await new Promise<ClientResult>((resolve, reject) => {
      w.onmessage = (ev: MessageEvent<WorkerResponse>) => {
        const m = ev.data;
        if (m.type === 'status') onStatus(t(m.message as MessageKey));
        else if (m.type === 'result') { w.terminate(); resolve({ controls: m.controls.map((c) => ({ pos: { e: c.pos[0], n: c.pos[1] }, kind: c.kind, locked: c.locked, dirGridDeg: c.dir })), metrics: m.metrics as GenResult['metrics'], stats: m.stats, candidates: m.candidates }); }
        else if (m.type === 'error') { w.terminate(); reject(new Error(m.code)); }
        else reject(new Error('worker-protocol'));
      };
      w.onerror = (e) => { w.terminate(); reject(new Error(`worker: ${e.message}`)); };
      const msg: WorkerRequest = { type: 'generate', key, osmText: text, setup: req.setup, start: [req.start.e, req.start.n], finish: [req.finish.e, req.finish.n], settings: req.settings, slots: req.slots, allowForest: req.allowForest };
      w.postMessage(msg);
    });
  })();
  return { promise, cancel };
}
