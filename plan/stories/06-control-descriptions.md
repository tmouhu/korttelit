# Theme F – Control descriptions

Standard: IOF Control Descriptions 2018 (columns A–H: sequence, code, which of similar, feature, appearance, dimensions/combination, location of flag, other information).

---

## US-26 Generate descriptions automatically · M · 8 pts
As a planner, I want descriptions generated for every control, so that I do not have to look up symbols.

Acceptance criteria
- For controls with known OSM feature (catalogue mapping in EN-11), columns D–H are filled (e.g. building corner → "building, corner / 0.0 / NE side" style symbols); sequence and code from course.
- "Which of similar" (col. C) generated where two controls of the same feature type are within 100 m (or when relevant per standard).
- Start and finish rows per standard (start/finish symbol/distance info for marked route when applicable – omitted in MVP).
- Manually placed controls without feature link: nearest feature within 10 m is suggested; otherwise left blank for manual edit.
- Symbols rendered from IOF SVG set; unit tests on mapping.
- Depends on: EN-08, EN-11.

## US-27 Place description sheet on the map · M · 5 pts
As a planner, I want to choose whether to include the description and where it goes, so that it does not hide important map content.

Acceptance criteria
- Toggle include/exclude.
- Drag the description box on the map/preview; snap to corners; stored as paper-mm position (scale independent).
- Size follows IOF layout (cell size 6 mm default; 5 mm / 7 mm option), with total-length and title header option.
- Overlap warning when box covers the course or map area marked as important (e.g. a control).
- Rendered identically in preview and PDF.

## US-28 Edit descriptions manually · S · 5 pts
As a planner, I want to override automatic descriptions, so that I can correct or complete them.

Acceptance criteria
- Click a cell to choose a symbol from the valid IOF list for that column; reset to automatic.
- Optional free-text column in Finnish/English (text description) shown in the sidebar and printable as a list.
- Overrides stored with the control.

## US-29 Descriptions in IOF XML and as standalone print · C · 3 pts
As a planner, I want to export descriptions with the course, so that other tools and sheets can use them.

Acceptance criteria
- IOF XML `ControlDescription` data written/read (where supported by the format) for each control.
- Standalone description sheet as separate PDF page (A4) in addition to the map.
