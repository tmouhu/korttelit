# EN-06 Spike result – OSM data without self-hosting (tested 2026-11-23, partial)

Query used: all `highway` ways in a 0.002° × 0.004° bbox in central Helsinki, `out geom`, JSON.

| Mirror | Result |
|---|---|
| `overpass-api.de` | 502 "at capacity, queue full" (twice, CORS header present) |
| `lz4.overpass-api.de` | 502 same message |
| `z.overpass-api.de` | timeout (30 s) |
| `overpass.private.coffee`, `overpass.kumi.systems` | timeout (40 s, from this network) |
| `maps.mail.ru/osm/tools/overpass` | 504 |
| **`overpass.openstreetmap.fr`** | **200 in 0.7 s, 240 kB** |

Findings
- Public Overpass reliability is **poor and varies by minute**. The app must rotate mirrors with timeout (≈ 15 s), exponential backoff, and cache results in IndexedDB. R2 is confirmed as a real risk, not a theoretical one.
- Payload is large for dense Helsinki: ~240 kB for 220 × 440 m of highways only. A full A3 frame with buildings, barriers and POIs may be 5–20 MB. Use the compact `out geom` selectively (separate small queries per feature group; `out tags geom qt`) and cache by frame.
- Still to evaluate: VersaTiles / OpenFreeMap fallback, Helsinki WFS, NLS OGC API (not yet probed).

Decision (provisional): implement a `DataSource` interface with an Overpass implementation first (mirror list configurable), add a vector-tile fallback if mirror reliability proves too low in M4.

## Update (M4, 2026-11-23): browser access NOT verified
- From this development sandbox every Overpass mirror answered "This service is only available to white-listed usages" as soon as the request carried an `Origin` header (curl with Origin, and fetch from the in-app browser). Requests without `Origin` (Node) worked on `overpass.openstreetmap.fr` only. Because all hosts returned the same text, this is probably the sandbox's network filter, not the services, but it is **unproven**. Test `fetchOsm()` from a normal browser on the deployed origin before relying on it.
- The pipeline (parse → graph → candidates → generator → worker → UI) was verified with a recorded real Helsinki response (`test/fixtures/helsinki-kamppi.json.gz`, 9 433 elements, ~1.1 × 1.4 km around Kamppi) injected via `window.__osmOverride`.
- If browser access is blocked in practice, options: other mirrors, a self-hosted Overpass/proxy (conflicts with the no-hosting decision), or the free vector-tile / Helsinki WFS fallbacks.
- Payload: ~3.6 MB JSON (580 kB gz) for 1.1 × 1.4 km of central Helsinki; large frames use a lean query (no pavements/crossings).
