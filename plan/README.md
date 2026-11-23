# Korttelisuunnistus – Urban Orienteering Course Planner

Browser-only web app for planning urban orienteering (korttelisuunnistus) courses in Finland, printing them to scale as PDF, and exchanging them as IOF XML.

## Contents

| File | Purpose |
|---|---|
| [epic-001-course-planner.md](epic-001-course-planner.md) | The epic: vision, scope, success criteria, milestones |
| [enablers.md](enablers.md) | Technical enablers and spikes (EN-xx) |
| [stories/01-map-area-and-print-setup.md](stories/01-map-area-and-print-setup.md) | US-01…US-05 |
| [stories/02-manual-course.md](stories/02-manual-course.md) | US-06…US-12 |
| [stories/03-auto-course.md](stories/03-auto-course.md) | US-13…US-19 |
| [stories/04-print-pdf.md](stories/04-print-pdf.md) | US-20…US-22 |
| [stories/05-iof-xml-and-storage.md](stories/05-iof-xml-and-storage.md) | US-23…US-25 |
| [stories/06-control-descriptions.md](stories/06-control-descriptions.md) | US-26…US-29 |
| [stories/07-general.md](stories/07-general.md) | US-30…US-32 |

## Feasibility: is a backend-free design possible?

**Yes, with two caveats.** Everything computational (projection, declination, routing, course generation, PDF, IOF XML) runs in the browser, with heavy work in Web Workers. The app is a static site (GitHub Pages / Cloudflare Pages).

| Concern | Verdict | Notes |
|---|---|---|
| Coordinate transforms (EPSG:3067) | Fine | proj4js |
| Magnetic declination | Fine | WMM/IGRF coefficients bundled in the app, no API call. Must also subtract grid convergence (see below) |
| Course generation & routing | Fine | Graph from vector-tile roads/paths for an area ≤ 4.5 × 6.3 km (A3 @ 1:15000) is small. Web Worker + A* |
| PDF generation | Fine | pdf-lib / jsPDF, vector course overlay, raster map underlay |
| **Mapant WMS in the browser** | **Caveat 1 (CORS)** | Displaying is fine. Embedding the WMS image in a PDF needs pixel access, which needs the server to send `Access-Control-Allow-Origin`. If it does not, options: (a) ask the Mapant maintainers to enable CORS, (b) a stateless CORS proxy (e.g. 20-line Cloudflare Worker) – technically a "backend", but trivial. Resolve in **EN-05** first. |
| **OSM vector tiles** | **Caveat 2 (source + tag fidelity)** | Public vector tile servers have usage limits/keys, and standard schemas (OpenMapTiles, Protomaps) drop tags we need (e.g. `barrier=*`, `tourism=artwork`, `man_made=*`, `access=*`, `foot=*`). **Decision: no self-hosted data** (target area initially Helsinki). Primary: Overpass API directly from the browser (CORS, full tags, per-frame query, cached in IndexedDB, mirror rotation). Fallback: free public vector tiles for network and buildings only. Optional enrichment: Helsinki WFS, NLS topographic database. Resolve details in **EN-06**. |
| Licensing | Needs attention | OSM (ODbL attribution), Mapant/NLS (CC BY 4.0 attribution), IOF symbol artwork. See **EN-13** |

## Key technical decisions (proposed)

1. **Map engine: OpenLayers**, not MapLibre. Print scale must be correct in TM35FIN, and OpenLayers renders natively in EPSG:3067 with view rotation and WMS support. MapLibre is Web-Mercator only, where 1 mm on paper at 1:4000 would be ~2× off at Finnish latitudes.
2. **Language:** TypeScript, Vite, Vitest, Playwright.
3. **Units:** the domain model stores positions in EPSG:3067 metres. Course symbols are defined in paper millimetres and converted via scale. Never store screen pixels.
4. **One renderer, two outputs:** course symbology is generated as a vector scene description (mm-based) that is drawn to the on-screen canvas and written to PDF. This guarantees WYSIWYG.
5. **Map rotation:** map content is rotated so magnetic north is up. Rotation = declination − meridian convergence (TM35FIN central meridian 27°E; convergence ≈ Δλ·sin φ). Sign convention and tests in **EN-02/EN-03**. Declination in southern Finland is roughly +7…+10°, and varies with location and date.
6. **Compute off main thread:** Web Workers for tile decoding, graph building, candidate scoring and generation.
7. **Persistence:** IndexedDB for autosave and tile cache; IOF XML 3.0 file for exchange.

### Architecture sketch

```
UI (OpenLayers map, panels)
 ├─ Course store (domain model, undo/redo, autosave)
 ├─ Print frame engine (paper × scale × rotation → TM35FIN polygon)
 ├─ Symbol renderer (IOF symbols, mm-based scene) ──► Canvas | PDF
 ├─ IOF XML 3.0 reader/writer
 ├─ Control description generator (feature → IOF 2018 symbols)
 └─ Web Workers
     ├─ OSM tile loader/decoder (PMTiles/MVT, IndexedDB cache)
     ├─ Feature extractor → candidate controls
     ├─ Navigation graph + A* router
     └─ Course generator (seeded, constraint search)
External (static/3rd-party): Mapant WMS, PMTiles file, optional Nominatim place search
```

### Print extents (ground area covered by the full sheet, portrait, before margins)

| Scale | A4 (210×297 mm) | A3 (297×420 mm) |
|---|---|---|
| 1:3000 | 630 × 891 m | 891 × 1260 m |
| 1:4000 | 840 × 1188 m | 1188 × 1680 m |
| 1:7500 | 1575 × 2228 m | 2228 × 3150 m |
| 1:10000 | 2100 × 2970 m | 2970 × 4200 m |
| 1:15000 | 3150 × 4455 m | 4455 × 6300 m |

## Roadmap (milestones)

| Milestone | Content | Items |
|---|---|---|
| M0 – Foundations & spikes | Scaffold, projection, declination, Mapant access, OSM tile source decision, IOF symbol sizes | EN-01…EN-06, EN-08 (spec), EN-13 |
| M1 – Map & print frame | Pick area, paper, scale, rotated map | US-01…05, EN-04, EN-09 |
| M2 – Manual course | Draw/edit course with correct IOF symbology | US-06…12, EN-07, EN-08 |
| M3 – Print & exchange | PDF export, IOF XML import/export, autosave | US-20…25 |
| M4 – Auto course | Candidates, routing, generator | US-13…19, EN-10, EN-11 |
| M5 – Descriptions | Auto control descriptions on map | US-26…29 |
| M6 – Polish | i18n, offline, help, perf | US-30…32, EN-12, EN-14 |

M4 is the highest-risk item; start EN-06 and EN-11 spikes early, in parallel with M1.

## Assumptions

- Target users: Finnish orienteering club members/coaches planning training; desktop browsers (Chrome, Firefox, Safari, Edge – evergreen). Tablet usable, phone not a priority.
- Urban courses follow ISSprOM 2019 conventions at 1:3000–1:5000; forest-oriented courses at 1:7500–1:15000 follow ISOM 2017-2. Symbol sizes are looked up from a table keyed by scale and verified against the IOF specifications (EN-08).
- Single course per project in MVP (multi-course is a "could" in US-12).
- Mapant is the only background map in MVP; OSM overlay is optional.
- Finland-only coverage; warn outside the Mapant/OSM extent.

## Open questions

1. **White stroke on control numbers:** is "1.5 mm" the total stroke width (0.75 mm outside the glyph) or 1.5 mm outside the glyph? Default proposal: 1.5 mm total width, configurable.
2. Which Mapant endpoint/layer is canonical (WMS vs WMTS), and may we rely on it for PDF export (terms of use)?
3. Should the generated course comply with a specific discipline's rules (e.g. Sprint-O leg rules) or is "training course" enough?
4. Should the tool support multiple courses/classes per event and a start/finish punching "map flip/change"? (assumed no for MVP)
5. Hosting preference and budget for the PMTiles file (Finland extract is roughly hundreds of MB to ~1 GB depending on layers).
6. Is a text-language description (Finnish/English prose) needed in addition to IOF symbols?
