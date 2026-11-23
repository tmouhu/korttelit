# Theme D – Print and PDF

---

## US-20 Download a PDF at exact scale · M · 8 pts
As a planner, I want to download a PDF of the map with the course, so that I can print it at the correct scale.

Acceptance criteria
- PDF page size = chosen paper (A4/A3, orientation); map printed at exactly the selected scale (100% print, no "fit to page" needed); a 100 mm scale bar measures 100 mm ± 0.5 mm.
- Map raster is the Mapant WMS image, rotated by declination so magnetic north is vertical; image requested at ≥ 300 dpi where the service allows.
- Course (circles, legs, numbers, start, finish) is vector, in correct colour and sizes (US-09).
- Includes attribution text (Mapant/NLS, OSM if used) per EN-13.
- Generation runs without freezing UI (progress indicator).
- Depends on: EN-05, EN-08, EN-09.

## US-21 Print preview and map furniture · S · 5 pts
As a planner, I want to preview and configure what appears on the sheet, so that the print is complete.

Acceptance criteria
- Preview shows the exact sheet.
- Toggle/configure: title, scale text, scale bar, north arrow/magnetic north lines (spacing configurable, default per standard), declination note, date, attribution, control description (US-27).
- Print area excludes margins; map is clipped to the map frame.

## US-22 Quality and file size options · C · 3 pts
As a planner, I want to trade quality against file size, so that downloads work on slow connections.

Acceptance criteria
- Options: 150 / 300 / 600 dpi map raster, JPEG vs PNG, with estimate of size.
- A3 at 300 dpi completes within memory limit on a mid-range laptop (EN-14); graceful error otherwise.
- Option for course-only layer (transparent PDF) to print on pre-printed maps.
