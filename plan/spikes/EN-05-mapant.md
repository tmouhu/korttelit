# EN-05 Spike result – Mapant WMS (tested 2026-11-23)

| Item | Finding |
|---|---|
| Endpoint | `https://www.mapant.fi/wms/wms.php?` (the older `wms.mapant.fi` host 307-redirects here; use the final URL) |
| Version / layer | WMS **1.1.1**, layer `MapAntFi` (only layer) |
| CRS | `EPSG:3067` only (native, no reprojection needed) |
| Extent | E 41637–754341, N 6580234–7800842 |
| Format | `image/png` (palette PNG) |
| Max size | **4000 px** per side (stated in AccessConstraints) |
| CORS | `access-control-allow-origin: *` on capabilities (GetMap confirmed working by curl; canvas read-back to be confirmed in browser test) |
| Licence | CC BY 4.0 → attribution required (Mapant / National Land Survey of Finland) |
| Resolution | 300×300 m sample at 1200 px (4 px/m) rendered sharply in central Helsinki |
| Rate limits | None documented |

Decisions
- Use the endpoint directly; no proxy needed.
- For PDF at 300 dpi, requests must be tiled to stay ≤ 4000 px (`wmsRequests()` in `src/core/printFrame.ts`). A3 @ 1:4000 at 300 dpi needs several tiles (bounding box of the rotated frame).
- Mapant colours are a limited palette with black buildings and orange streets, so it looks different from ISSprOM; acceptable, since it is the user's requested default.
- Confirmed in browser (OpenLayers `TileWMS`, `crossOrigin: 'anonymous'`): canvas `toDataURL()` works, so PDF embedding needs no proxy.
