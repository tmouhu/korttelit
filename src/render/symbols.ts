import names from '../assets/symbol-names.json';

// Symbol artwork comes from the `svg-control-descriptions` package (extracted from Purple Pen). Licence of the
// artwork is "a bit unclear" per its README — see plan/enablers.md EN-13 before distributing.
const files = import.meta.glob('/node_modules/svg-control-descriptions/symbols/*.svg', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;

export interface SymbolInfo { col: string; fi: string; en: string }
export const SYMBOL_INFO = names as Record<string, SymbolInfo>;

const cache = new Map<string, Promise<HTMLImageElement | undefined>>();

/** Load one symbol as an image (resolves undefined when the id is unknown). */
export function loadSymbol(id: string): Promise<HTMLImageElement | undefined> {
  let p = cache.get(id);
  if (!p) {
    const loader = files[`/node_modules/svg-control-descriptions/symbols/${id}.svg`];
    p = loader
      ? loader().then((svg) => new Promise<HTMLImageElement | undefined>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(undefined);
          // the package writes stroke-width="null" on filled shapes
          img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/stroke-width="null"/g, 'stroke-width="0"'))}`;
        }))
      : Promise.resolve(undefined);
    cache.set(id, p);
  }
  return p;
}

const loaded = new Map<string, HTMLImageElement>();
export async function ensureSymbols(ids: Iterable<string>): Promise<void> {
  await Promise.all([...new Set(ids)].map(async (id) => { if (!loaded.has(id)) { const i = await loadSymbol(id); if (i) loaded.set(id, i); } }));
}
export const getSymbol = (id: string): HTMLImageElement | undefined => loaded.get(id);

/** Ids of symbols usable in a description column ('c'…'h'). */
export function symbolsForColumn(col: string): string[] {
  const k = col.toUpperCase();
  return Object.keys(SYMBOL_INFO).filter((id) => SYMBOL_INFO[id]!.col === k && files[`/node_modules/svg-control-descriptions/symbols/${id}.svg`]);
}

/** data: URL of a loaded symbol (for <img> use). */
export const symbolUrl = (id: string): string | undefined => loaded.get(id)?.src;
