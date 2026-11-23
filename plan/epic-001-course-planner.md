# EPIC-001 – Urban Orienteering Course Planner (Korttelisuunnistus)

## Vision

A club coach opens a web page, picks an area of Finland, chooses paper size and scale, and gets a print-ready, correctly rotated orienteering map with an IOF-compliant course, either drawn by hand or generated automatically from OSM data. They download a PDF for winter training and an IOF XML file for other tools.

## Problem

Planning urban training courses in OCAD/Purple Pen requires a base map file and desktop software. Korttelisuunnistus does not need a surveyed map: Mapant plus OSM is sufficient. A lightweight, no-install, no-account tool lowers the barrier to organising training.

## Scope

In scope:
- Print-area selection (A4/A3, 1:3000, 1:4000, 1:7500, 1:10000, 1:15000), EPSG:3067 (EUREF-FIN TM35FIN), rotation by magnetic declination
- Mapant WMS as default background
- Manual course drawing and editing with IOF symbology and scale-correct symbol sizes
- Automatic course generation from start, finish and crow-fly distance, using OSM vector tile data, entirely in the browser
- Automatic control descriptions; optional placement on the map
- PDF export to scale; IOF XML 3.0 export and import
- Finnish and English UI

Out of scope (MVP):
- Any backend service, user accounts, cloud sync, sharing links
- Event management (entries, results, timing)
- Multi-course / relay / score / butterfly course types (could come later)
- Custom map upload (OCAD/OOM), other background maps
- Mobile phone layout, GPS live tracking

## Success criteria

1. A printed A4 at 1:4000 measures exactly 100% scale (a 100 mm scale bar measures 100 mm ± 0.5 mm) and magnetic north is vertical on the sheet.
2. Control circle, start, finish, line widths, number size and white halo match the sizes defined for the scale (EN-08), verified visually against Purple Pen output.
3. Generated course for a given start/finish/distance is within ±10% of the requested crow-fly distance in ≥ 95% of tested urban areas (5 Finnish towns), and every control is reachable by a path route.
4. Auto-generation for an A3 @ 1:15000 area completes in < 15 s on a mid-range laptop (generation runs in a Worker, UI stays responsive).
5. IOF XML round-trip: export then import yields identical controls (position ≤ 0.1 m) and sequence; a file exported by the app opens in Purple Pen and Routegadget-compatible tools.
6. No server code required to run the app (static hosting only), unless EN-05 forces a CORS proxy, which is then documented as the single exception.

## Feature breakdown

| Theme | Stories | Enablers |
|---|---|---|
| A. Map area & print setup | US-01…US-05 | EN-02, EN-03, EN-04, EN-05, EN-09 |
| B. Manual course | US-06…US-12 | EN-07, EN-08 |
| C. Automatic course | US-13…US-19 | EN-06, EN-10, EN-11 |
| D. Print / PDF | US-20…US-22 | EN-08, EN-09 |
| E. IOF XML & storage | US-23…US-25 | EN-07, EN-12 |
| F. Control descriptions | US-26…US-29 | EN-08, EN-11 |
| G. General | US-30…US-32 | EN-01, EN-14 |
| Cross-cutting | | EN-01, EN-12, EN-13 |

## Risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | Mapant WMS CORS (user confirms cross-domain is allowed) | Low | EN-05 verifies endpoint, layers and resolution only |
| R2 | Overpass limits/downtime; vector tile fallback lacks tags | High | EN-06; mirror rotation, IndexedDB cache, one query per frame, degraded vector-tile mode |
| R3 | Auto-generated courses feel poor (bad legs, unsafe crossings) | High | Seeded generator, quality metrics, lock/replace control, user-tested iterations |
| R4 | Symbol sizes/rules misread from IOF specs | Medium | EN-08 verification against specs and Purple Pen output |
| R5 | Rotation/declination sign or convergence errors | Medium | EN-02/03 tests with known reference points |
| R6 | Mapant resolution too coarse at 1:3000 | Medium | Request max available resolution; show warning; document |
| R7 | Licensing/terms of Mapant/OSM/IOF artwork | Medium | EN-13 |
| R8 | OSM data safety: controls on private yards, road crossings | Medium | Exclusion rules (access=private, etc.), user disclaimer, user reviews course |

## Milestones

See [README roadmap](README.md#roadmap-milestones) (M0 foundations → M6 polish).

## Definition of done (epic)

All must-have stories accepted, success criteria 1–6 demonstrated on at least three real Finnish urban areas, documentation (README, user guide fi/en), static deployment live.
