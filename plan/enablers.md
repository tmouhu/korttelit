# Enablers

Size: S ≤ 2 days, M ≤ 1 week, L ≤ 2 weeks. Type: **Spike** = time-boxed research with written outcome; **Infra**; **Arch**.

---

## EN-01 Project scaffold and tooling
Type: Infra · Size: S · Milestone M0
- Vite + TypeScript (strict), ESLint/Prettier, Vitest, Playwright, GitHub Actions CI, static deploy (Cloudflare/GitHub Pages).
- i18n library with `fi` and `en` message catalogs; no hard-coded UI strings.
- Folder layout: `core/` (pure logic, no DOM), `render/`, `workers/`, `ui/`.

Acceptance: CI builds, lints, runs tests and deploys a hello-world page; `core/` has no DOM imports (lint rule).

## EN-02 Coordinate and rotation library
Type: Arch · Size: S · M0
- proj4 definitions for EPSG:3067 (TM35FIN) and EPSG:4326; helper functions both directions.
- Meridian convergence at a point; rotation about a point; ground↔paper-mm transforms for a print frame.
- Unit tests vs known points (e.g. published TM35FIN coordinates of Helsinki, Oulu, Rovaniemi) and rotation round-trips.

Acceptance: round-trip error < 1 mm; documented sign conventions for convergence and rotation.

## EN-03 Magnetic declination service (offline)
Type: Arch · Size: S · M0
- Bundle WMM (or IGRF) coefficients; compute declination for lat/lon/date in browser (e.g. `geomagnetism` package or own implementation).
- Combine with convergence: `mapRotation = declination − convergence` (verify sign convention in tests).
- Show value to user and allow override (feeds US-03).

Acceptance: values within 0.2° of NOAA/FMI calculator for 5 Finnish locations; works offline; unit-tested.

## EN-04 Map view engine in EPSG:3067 with rotation
Type: Arch · Size: M · M1
- OpenLayers view with projection EPSG:3067, rotation, WMS layer, controlled resolution so that the print frame maps to known mm.
- Resolution/zoom set to "map scale" display modes; pan/zoom limited to Finland extent.

Acceptance: a 100 m ground distance draws as 100 m on a calibrated scale at any rotation; WMS loads at native resolution.

## EN-05 Spike: Mapant WMS access
Type: Spike · Size: S · M0 (do first)
Determine:
1. Canonical endpoint, layer names, supported CRS (EPSG:3067 directly?), max pixel size, formats.
2. CORS headers (can a canvas read the image for PDF?).
3. Resolution available at 1:3000 vs 1:15000 and rendering quality at 300 dpi.
4. Terms of use, rate limits, attribution requirements.
5. Contact/permission path with maintainers.

Output: `plan/spikes/EN-05-mapant.md` with decision: direct / proxy / WMTS alternative.

## EN-06 Spike: OSM data source without self-hosting
Type: Spike · Size: M · M0
**Constraint (decided): no self-hosted data. Initial target area: Helsinki.** Proposed outcome: Overpass API from the browser as primary (full tags), free public vector tiles (OpenFreeMap / VersaTiles Shortbread) as degraded fallback (network + buildings only), Helsinki WFS (kartta.hel.fi) and NLS topographic database (needs free API key) as optional enrichment.
Compare: (a) Overpass public mirrors (CORS, rate limits, query size, latency, caching in IndexedDB), (b) free public vector tile services and their schemas, (c) Helsinki open-data WFS, (d) NLS OGC API Features. Self-built PMTiles is rejected (would need hosting).
Evaluate tag coverage for: footways/paths/service roads, `foot=*`/`access=*`, barriers (fence, wall, gate), buildings, water, landuse (forest, grass, parks), POIs (statue, artwork, bench, well, fountain, picnic table, bus stop, boulder, tree), man_made features, railways, bridges/tunnels/steps.
Measure: tile size, download size for an A3@1:15000 area, hosting cost, update frequency, licence.

Output: ADR with chosen source and defined layer schema; fallback documented.

## EN-07 Course data model, state store and persistence
Type: Arch · Size: M · M2
- Types: Project, MapSetup (centre, paper, orientation, scale, rotation override), Course (start, controls[], finish), Control (id, code, position EPSG:3067, feature ref, description, label offset), DescriptionSheet placement.
- Immutable state with undo/redo (command pattern), autosave to IndexedDB, schema versioning/migrations.
- Pure TypeScript, no DOM; fully unit-tested.

Acceptance: 100 undo steps without drift; load of an older schema version migrates.

## EN-08 IOF symbology and symbol size specification
Type: Arch + Spike · Size: L · M0 spec, M2 impl
- Spike: extract exact specs from IOF *Specification for Course Planning* / ISSprOM 2019 / ISOM 2017-2 Appendix (control circle diameter, line width, start triangle, finish double circle, leg gaps, number font size/position, colour = overprint purple/magenta, enlargement factors per scale). **Provisional values to verify:** circle Ø 6.0 mm, line 0.35 mm, triangle side 7.0 mm, finish Ø 5/7 mm, number ≈ 4 mm tall, white halo 1.5 mm (user requirement). Table keyed by scale (1:3000, 4000, 7500, 10000, 15000) with documented source.
- Renderer: produce a mm-based scene (circles, triangles, lines, text with halo) and render to Canvas and PDF from the same description.
- Leg lines are trimmed at control circles; no line through the circle or number.
- Control description symbol set (IOF 2018 columns C–H) as SVG; check IOF licence for redistribution (EN-13).

Acceptance: output overlaid on a Purple Pen reference print at the same scale differs by ≤ 0.2 mm for all symbols; specs doc committed.

## EN-09 Print frame geometry engine
Type: Arch · Size: M · M1
- Input: centre (EPSG:3067), paper size, orientation, scale, margins, rotation → polygon in ground coordinates, map-to-paper transform, WMS request bbox (bounding box of rotated rectangle), required pixel size for target dpi.
- Same engine feeds on-screen frame (US-02) and PDF (US-20).

Acceptance: unit tests for all 10 paper × scale combos; frame corners round-trip to paper mm within 0.01 mm.

## EN-10 Web Worker infrastructure and OSM data loader
Type: Infra · Size: M · M4
- Worker pool with typed message API (Comlink or similar), cancellation, progress reporting.
- Tile fetch (PMTiles range requests / MVT), decode (`pbf`, `@mapbox/vector-tile`), reproject to EPSG:3067, cache in IndexedDB with expiry.
- Area budget: loads only tiles intersecting the frame plus margin for the generation search area.

Acceptance: A3@1:15000 area loads and decodes in < 5 s on broadband; main thread never blocked > 50 ms.

## EN-11 OSM feature extraction and navigation graph
Type: Arch · Size: L · M4
- Normalise OSM features into: walkable network (highway classes, `foot`, `access`, `surface`, steps/bridges/tunnels), barriers (fences, walls, water, railways, buildings, restricted areas), open/forest area polygons, point/line/area objects usable as controls.
- Build routing graph with cost per class; off-path travel through forest/open areas modelled with penalty cost and visibility grid or via polygon edges; barriers block.
- A* shortest path with route length output; graph unit tests with fixtures.
- Define the **control suitability catalogue** (feature type → eligibility, IOF symbol mapping, priority) as data (`catalogue.json`) shared with descriptions (US-26).

Acceptance: route between any two reachable points within 3% of optimal on test graph; blocked by fence/water/railway as expected; catalogue reviewed by an orienteer.

## EN-12 Test fixtures and quality gates
Type: Infra · Size: M · M3
- Sample IOF XML files (Purple Pen, OCAD, OOM, Condes exports) for import tests.
- PDF golden tests: measure scale bar and symbol sizes from rasterised PDF; visual regression with Playwright.
- Generator test areas (5 Finnish towns) with fixed seeds and metrics (distance error, reachability, leg stats).

## EN-13 Licensing, attribution and compliance
Type: Infra · Size: S · M0
- Mapant (NLS open data, CC BY 4.0) and OSM (ODbL) attribution on screen and in PDF; IOF symbol artwork terms; third-party library licences.
- Disclaimer text for safety (roads, private land) shown at export.
- **Open (M5):** control description symbols come from the npm package `svg-control-descriptions` (ISC for the code; its README says the artwork, extracted from Purple Pen, has an unclear licence). Decide before public release: get permission/confirm licence, or replace with own artwork. The package's symbol numbering (Purple Pen) differs slightly from the 2018 spec's reference numbers (e.g. 5.24 stairway vs 5.22), see `src/core/descriptions.ts`.
- IOF 3.0 XML `CourseData` has no element for control descriptions (verified against the XSD), so descriptions/feature types are stored only in this app's `osmk:` extension.

## EN-14 Performance, size budgets and browser support
Type: Infra · Size: S · M6
- Bundle budget (initial < 400 kB gz excluding lazy chunks), PDF generation memory limits (A3 at 300 dpi), browser matrix, accessibility checks (keyboard, contrast).
