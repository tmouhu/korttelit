# Theme B – Manual course drawing and editing

---

## US-06 Place start, controls and finish by clicking · M · 5 pts
As a planner, I want to click on the map to add the start, controls and finish, so that I can draw a course by hand.

Acceptance criteria
- Tool modes: Start, Control, Finish; one start and one finish maximum; controls are numbered in sequence (31, 32, … default starting number configurable, or 1…n).
- Each new control is connected to the previous by a leg line.
- Positions are stored as EPSG:3067 metres; shown correctly when frame is rotated.
- Optional snap to OSM feature (when OSM overlay loaded) – could.
- Depends on: EN-07, EN-08.

## US-07 Edit course · M · 5 pts
As a planner, I want to move, delete, insert and reorder controls, so that I can refine the course.

Acceptance criteria
- Drag a control to move it; leg lines update live.
- Delete a control; sequence and numbers renumber.
- Insert a control by dragging on a leg line or "insert after" action.
- Reorder via list drag-and-drop.
- Start/finish can be moved and deleted.
- All actions undoable (US-11).

## US-08 Control numbers with white halo · M · 3 pts
As a planner, I want control numbers to be readable on any background, so that the printed map is legible.

Acceptance criteria
- Number drawn in course colour with a white stroke of 1.5 mm (paper size, scale-independent; confirm interpretation – README open question 1).
- Number is placed beside the circle (default up-right) avoiding other course symbols; draggable offset stored per control.
- Number never overlaps its own circle or leg line.
- Depends on: EN-08.

## US-09 Scale-correct IOF symbols for course · M · 8 pts
As a planner, I want the course drawn with IOF symbols at the correct size for the chosen scale, so that the printed map follows the standard.

Acceptance criteria
- Start triangle (pointing to first control), control circle, finish double circle, leg lines (gaps at circles, no crossing through numbers), per the size table of EN-08.
- Sizes change with scale as defined; the same renderer is used on screen and in PDF.
- Measured sizes in a rasterised PDF match the table within ±0.1 mm.
- Depends on: EN-08, EN-09.

## US-10 Course statistics · S · 2 pts
As a planner, I want to see length and number of controls, so that I can judge the course.

Acceptance criteria
- Shows: total crow-fly distance (start→controls→finish), number of controls, per-leg lengths.
- Optional: estimated shortest route length via path graph when OSM data is available (EN-11).

## US-11 Undo and redo · M · 2 pts
As a planner, I want to undo and redo, so that I can experiment safely.

Acceptance criteria
- Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z; applies to all course and layout changes including auto generation.
- Depends on: EN-07.

## US-12 Multiple courses in a project · C · 5 pts
As a planner, I want several courses (e.g. short/long) over the same map, so that different classes can run.

Acceptance criteria
- Add/rename/duplicate/delete courses; each exports as its own PDF page/file and IOF `Course` element.
- Controls can be shared between courses (same control code).
