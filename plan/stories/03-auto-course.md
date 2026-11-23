# Theme C – Automatic course generation

All computation is in the browser (Web Worker). Data source: OSM vector tiles (EN-06). Distance definition: **crow-fly distance** = sum of straight-line leg lengths start → control₁ → … → finish.

---

## US-13 Generate a course from start, finish and distance · M · 8 pts
As a planner, I want to set a start, a finish and a target distance and have the app build a course, so that I do not need to select each control manually.

Acceptance criteria
- Inputs: start point, finish point (click on map; may be identical for a loop), target crow-fly distance (m), tolerance default ±10%.
- Output: ordered controls placed on suitable OSM objects; total crow-fly distance within tolerance or a clear message that none was found, with best attempt.
- Generation runs in a Worker with progress and cancel; UI stays responsive.
- Result replaces or is added to the current course (confirm if non-empty); undoable.
- Minimum feasibility check: if distance < straight line start→finish, show message.
- Depends on: US-14, US-15, US-16, EN-10, EN-11.

## US-14 Suitable control candidates from OSM · M · 8 pts
As a planner, I want controls to be placed on real, recognisable features, so that the course is navigable.

Acceptance criteria
- Candidate catalogue (EN-11) includes, at minimum: building corners (non-private, visible), path/road junctions and dead-ends, bridges, stairs, fences/wall ends and corners, statues/monuments/art, wells/fountains, benches, picnic tables, bus stops, playground items, boulders, distinct trees, pond/water edges, small open areas, forest features where tagged (clearings, paths ends).
- Excluded: `access=private/no`, `foot=no`, military/industrial restricted areas, inside buildings, in water, on road carriageways or railway tracks, near high-speed road crossings.
- Each candidate has: position, type, IOF description symbol mapping, priority weight.
- Catalogue is data-driven and unit-tested; includes a debug overlay to show candidates.
- Depends on: EN-11.

## US-15 Reachability and runnability · M · 8 pts
As a planner, I want every control to be reachable on foot, so that nobody has to cross barriers.

Acceptance criteria
- Each control is connected to the start and previous control by a route in the navigation graph (paths, pavements, roads allowed with penalty, open areas and forest via polygon rules).
- Barriers (fences, water, railways, buildings, `access=no`) are impassable except at gates/crossings.
- Route length for each leg is computed; legs with route/crow-fly ratio above a threshold (e.g. > 2.5) are rejected.
- A control location must itself be within a short distance (≤ 15 m default) of runnable terrain.
- Depends on: EN-11.

## US-16 Course quality and distance targeting · M · 8 pts
As a planner, I want generated courses to be well-formed, so that they are useful training.

Acceptance criteria
- Algorithm: seeded randomised constructive search with local improvement (e.g. simulated annealing) minimising |distance − target| plus penalties.
- Constraints: leg length min/max (configurable, defaults scale-dependent), no control closer than 40 m to another, no leg crossing/overlapping another by more than a threshold, varied leg directions and lengths (not a zig-zag line), controls not clustered, course stays inside print frame.
- Same seed + inputs → identical course (reproducible); seed shown.
- Quality metrics recorded in test suite (EN-12).

## US-17 Controls in forest areas · S · 5 pts
As a planner, I want to include controls in forests and parks, so that courses can mix streets and terrain.

Acceptance criteria
- Option "Allow forest/park controls" (off by default for urban scales ≤ 1:4000; on for 1:10000+).
- Forest candidates from OSM features (clearings, paths, streams, rocks, tagged boulders, wood edge corners) and from polygon geometry (corner/edge points) with lower priority.
- Reachability uses forest penalty cost; excluded if `access=no`/nature reserve restrictions known in data.

## US-18 Review, lock, replace and regenerate · M · 5 pts
As a planner, I want to adjust a generated course without losing the good parts, so that I can iterate.

Acceptance criteria
- Lock individual controls and start/finish; "Regenerate" changes only unlocked ones; new seed button.
- "Suggest alternative" for a single control (shows 3–5 candidates nearby).
- Each control shows its feature type (e.g. "building corner") in the sidebar.
- Result editable with all US-07 actions.

## US-19 Generation settings · S · 3 pts
As a planner, I want to tune the generator, so that I get the kind of course I need.

Acceptance criteria
- Settings: number of controls (auto from distance or fixed), leg length range, tolerance, avoid road crossings, allow forest (US-17), feature type filters.
- Presets: "Training short", "Sprint-style", "Long".
- Settings saved with the project.
