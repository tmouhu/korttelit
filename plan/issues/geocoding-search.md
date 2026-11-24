# Add place and address search to move the print frame

**Labels:** enhancement

## Why
To plan a course in a new area the user must pan the map by hand from wherever the frame happens to be. A search box ("Kamppi", "Mannerheimintie 5, Helsinki") should move the print frame there.

## Options checked (2026-11-24)

| Provider | Key | Browser use | Terms | Verdict |
|---|---|---|---|---|
| **Nominatim** (nominatim.openstreetmap.org) | none | `Access-Control-Allow-Origin: *` (tested) | ≤ 1 request/s, valid Referer (browsers send it), results must be cached, ODbL attribution, **client-side autocomplete is forbidden**; non-commercial public use fine ([policy](https://operations.osmfoundation.org/policies/nominatim/)) | **Use first**, search on submit only |
| **Photon** (photon.komoot.io) | none | `Access-Control-Allow-Origin: *` (tested) | "reasonable" use, may be throttled or banned, no SLA; data ODbL; software Apache-2.0 | Optional typeahead later, behind a flag |
| **National Land Survey geocoding API** (avoin-paikkatieto.maanmittauslaitos.fi/geocoding) | free API key (My Account) | not tested | Pelias-style GeoJSON, can return EPSG:3067 directly, sources: place names, addresses, interpolated road addresses; check the open-data licence text before use | Best Finnish data, but needs key handling (Phase 2) |
| Digitransit geocoding | registration / key | not tested | Pelias, transport-oriented | Not needed |
| Google, Mapbox and similar | key | yes | licences restrict use outside their own maps and storing results | Rejected |

## Proposed solution
### Phase 1: Nominatim, search on submit
- New `src/data/geocode.ts` with a small `GeocoderProvider` interface (`search(query, lang, signal) → Place[]`) and a Nominatim implementation: `GET /search?q=…&format=jsonv2&limit=6&countrycodes=fi&accept-language=<ui lang>&addressdetails=0`.
- Policy compliance: single in-flight request, at least 1.1 s between requests, no search-as-you-type (search runs on Enter / button), cache results in `localStorage` for 24 h keyed by normalised query, do not send repeated identical queries.
- UI: search field in the top-left of the map (below the toolbar on phones). Enter shows up to 6 results; choosing one converts lon/lat to EPSG:3067 (`lonLatToTM35`), sets the frame centre, calls `fitToFrame()` and saves state. Esc or a click elsewhere closes the list. Results outside the MapAnt extent are shown greyed out with the existing coverage warning.
- Messages (fi/en): no results, network error, rate limited (HTTP 429 → "try again in a minute"), offline.
- Attribution: add "Place search: © OpenStreetMap contributors (ODbL), Nominatim" to the About text and the attribution line. Add a privacy note that the search text is sent to nominatim.openstreetmap.org.
- Service worker must not cache these requests (they are cross-origin and not `mapant.fi`, so already bypassed; add a test or comment).

### Phase 2 (optional, separate issue)
- NLS provider (Finnish addresses and place names, EPSG:3067 output) with a user-supplied key stored locally, or a project key if the licence and key terms allow shipping one in a public client.
- Photon provider with debounce for typeahead, off by default.

## Acceptance criteria
- [ ] Searching "Kamppi" in Helsinki moves and zooms the frame there; the frame keeps its paper, scale and rotation (rotation recomputed for the new location).
- [ ] Never more than 1 request per second; the same query within 24 h makes no request.
- [ ] Works in Finnish and English UI; keyboard accessible (Enter, arrow keys, Esc); usable on phone width.
- [ ] Errors are shown as readable messages, not console errors.
- [ ] Unit tests with a recorded Nominatim response (parsing, coordinate conversion, throttle, cache, error mapping).
- [ ] Attribution and privacy text added.

## Out of scope
Reverse geocoding, autocomplete on the public Nominatim server, saving favourite places.

## Status
Phase 1 implemented (Nominatim, search on submit, 1 request/s, 24 h cache, fi/en messages, attribution). Phase 2 (NLS / Photon) not started.
