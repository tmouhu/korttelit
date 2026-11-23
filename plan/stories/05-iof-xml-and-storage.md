# Theme E – IOF XML and storage

Format: IOF Data Standard 3.0, `CourseData` document.

---

## US-23 Export course as IOF XML · M · 5 pts
As a planner, I want to save my course as IOF XML, so that I can use it in other orienteering tools.

Acceptance criteria
- Valid against the IOF 3.0 XML schema (automated test).
- Contains: `Control` elements (id/code, type Start/Control/Finish, `Position` lat/lng WGS84, `MapPosition` in mm on paper where meaningful), `RaceCourseData` with `Map` (scale, map position/resolution), `Course` with `CourseControl` sequence and length (m).
- Control descriptions (US-29) included when available.
- App-specific data (frame centre, paper, rotation, generator settings) stored under an extension element, ignored by other tools.
- Opens successfully in Purple Pen (manual check recorded).
- Depends on: EN-07, EN-02.

## US-24 Import course from IOF XML · M · 5 pts
As a planner, I want to load a course from an IOF XML file, so that I can print or edit courses made elsewhere.

Acceptance criteria
- Imports files produced by this app, Purple Pen, OCAD, OOM (fixtures from EN-12).
- Controls positioned from WGS84 `Position`; if only `MapPosition` is available, ask for/derive map reference or report that placement is impossible.
- Frame is positioned to fit the imported course at the chosen scale when no app extension is present.
- Clear, localised errors for invalid/unsupported files; partial import with warnings.
- Round-trip test: export → import equals original (positions ≤ 0.1 m, same order).

## US-25 Save and restore work locally · S · 3 pts
As a planner, I want my project to survive page reloads, so that I do not lose work.

Acceptance criteria
- Autosave to IndexedDB after each change (debounced); "restore last session" on load.
- Project list with rename/delete; "Download project" (IOF XML with extension) and "Open project".
- Storage failure (quota/private mode) shows a warning and still allows file export.
- Depends on: EN-07.
