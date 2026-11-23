// Derives src/assets/symbol-names.json (fi + en names and description column per symbol) from the svg-control-descriptions package.
import { readFileSync, writeFileSync } from 'node:fs';
const lang = JSON.parse(readFileSync('node_modules/svg-control-descriptions/symbols/lang.json', 'utf8'));
const out = {};
for (const [id, v] of Object.entries(lang)) out[id] = { col: v.kind, fi: v.names?.fi ?? v.names?.en ?? id, en: v.names?.en ?? id };
writeFileSync('src/assets/symbol-names.json', JSON.stringify(out));
console.log(Object.keys(out).length, 'symbols');
