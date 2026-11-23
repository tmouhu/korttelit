# Theme A – Map area and print setup

Priority: M = must, S = should, C = could. Size in story points (1,2,3,5,8).

---

## US-01 Choose paper size and scale · M · 3 pts
As a course planner, I want to select A4 or A3 and a scale (1:3000, 1:4000, 1:7500, 1:10000, 1:15000), so that the map area matches what I will print.

Acceptance criteria
- Paper (A4, A3) and scale are selectable; defaults A4, 1:4000.
- Changing either updates the print frame on the map immediately, keeping the same centre.
- Ground extent (m) of the frame is displayed (see README table).
- Depends on: EN-09, EN-04.

## US-02 Position the print frame on the map · M · 5 pts
As a planner, I want to move the print frame to the area I want, so that I can cover the right neighbourhood.

Acceptance criteria
- Frame is shown on the map as a rotated rectangle (US-03); drag to move; map pans freely beneath.
- Place search (Nominatim/geocoder) and "enter TM35FIN coordinates" to centre the frame.
- Frame is clamped to Finland extent; warning outside Mapant coverage.
- Depends on: EN-09, EN-04.

## US-03 Map rotated by magnetic declination · M · 5 pts
As a planner, I want the map content rotated so magnetic north is up, using the declination for the map location, so that the printed map works with a compass.

Acceptance criteria
- Rotation is computed automatically from location and current date: declination minus grid convergence (EN-02/03). Value shown (e.g. "Declination +8.6°, rotation 8.4°").
- Manual override with an "auto" reset.
- The map view and print preview show north lines/arrow pointing up on the sheet; geographic placement is verified by test against known point.
- Frame, WMS request and PDF use the same rotation.
- Depends on: EN-02, EN-03, EN-09.

## US-04 Portrait or landscape · M · 2 pts
As a planner, I want to choose portrait or landscape, so that the sheet fits the area shape.

Acceptance criteria
- Toggle swaps paper dimensions; frame updates; frame keeps its centre.
- Default chosen from the longer axis of the course once a course exists (suggestion only).

## US-05 Map area summary and print margins · S · 2 pts
As a planner, I want to see key facts about the sheet, so that I can verify before printing.

Acceptance criteria
- Shows: paper, scale, ground size, corner coordinates in TM35FIN (N, E), declination, rotation.
- Configurable margins (default 10 mm) and optional title/info box area; margins excluded from the map area calculation consistently across screen and PDF.
