# Korttelit – urban orienteering course planner (korttelisuunnistus)

Browser-only planner for urban orienteering (korttelisuunnistus) in Finland. Pick an area on a MapAnt background in EUREF-FIN TM35 (EPSG:3067), choose A4/A3 and a scale (1:3000 … 1:15000), draw a course or generate one from OSM data, and download a print-ready PDF at true scale. Courses are exchanged as IOF XML 3.0. UI in Finnish and English. No backend.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (vitest)
npm run build      # typecheck + production build
npm run check:size # entry-chunk gzip budget
```

Planning documents (epic, stories, enablers, spike results): [plan/](plan/README.md).

## How it works

| Area | Where |
|---|---|
| Projection, declination, map rotation (declination − grid convergence) | `src/core/projection.ts`, `declination.ts` |
| Print frame geometry (paper × scale × rotation) | `src/core/printFrame.ts` |
| Course model, undo/redo | `src/core/course.ts` |
| IOF symbols as a paper-mm scene (screen + PDF share it) | `src/core/symbols.ts` |
| PDF export (MapAnt WMS tiles, vector course) | `src/render/pdf.ts` |
| IOF XML 3.0 export/import (validated against the official XSD) | `src/core/iofxml.ts` |
| OSM data (Overpass), graph, candidates, generator, Web Worker | `src/data/`, `src/gen/` |
| Control descriptions (IOF symbols), sheet renderer, editor | `src/core/descriptions.ts`, `src/render/`, `src/ui/descriptionEditor.ts` |
| i18n (fi/en) | `src/i18n.ts` |
| Offline (service worker, area prefetch) | `public/sw.js` |

## Known limits / open items

- **Symbol sizes** for course overprint are provisional (`src/core/symbols.ts`, see `plan/spikes/EN-08-symbol-sizes.md`).
- **Overpass access from browsers** was not verifiable in the development sandbox (`plan/spikes/EN-06-osm-data.md`). Test on a deployed origin.
- **Symbol artwork licence** (svg-control-descriptions / Purple Pen) is unclear; resolve before public release (`plan/enablers.md` EN-13).
- Safety: always review generated courses on site (roads, private land, winter conditions).

Attribution: MapAnt.fi / National Land Survey of Finland (CC BY 4.0); © OpenStreetMap contributors (ODbL).
