// Bundle budget (EN-14): the initial JS (entry chunk) must stay under the gzip budget; lazy chunks (PDF, XML, symbols) are reported.
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const BUDGET_KB = Number(process.env.BUDGET_KB ?? 220);
const dir = 'dist/assets';
const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
let failed = false;
let small = 0;
for (const f of files.sort()) {
  const kb = gzipSync(readFileSync(`${dir}/${f}`)).length / 1024;
  const entry = f.startsWith('index-');
  if (!entry && kb < 5) { small++; continue; } // e.g. one tiny chunk per description symbol
  console.log(`${entry ? 'ENTRY' : 'lazy '} ${kb.toFixed(1).padStart(7)} kB gz  ${f}`);
  if (entry && kb > BUDGET_KB) { console.error(`Entry chunk ${f} is ${kb.toFixed(1)} kB gz, budget ${BUDGET_KB} kB`); failed = true; }
}
console.log(`(+ ${small} small lazy chunks < 5 kB)`);
process.exit(failed ? 1 : 0);
