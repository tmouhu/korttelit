# Theme G – General

---

## US-30 Finnish and English UI · S · 3 pts
As a Finnish or international user, I want the UI in my language, so that I understand it.

Acceptance criteria
- Language switch fi/en; default from browser; all strings from catalogs (EN-01); symbol names and error messages localised.
- Number/coordinate formatting follows locale (comma decimal in fi).

## US-31 Offline and tile cache · C · 5 pts
As a trainer working in the field or poor connectivity, I want the app and previously used map data to work offline, so that I can edit courses without internet.

Acceptance criteria
- PWA installable; app shell cached via service worker.
- Previously loaded OSM tiles cached (EN-10); Mapant images cached for the current frame at print resolution on request ("download area for offline").
- Cache size shown, with clear option.

## US-32 Coverage warnings, help and disclaimers · S · 3 pts
As a user, I want to know the limits of the tool, so that I use it safely.

Acceptance criteria
- Warning when frame is outside Finland or data is missing.
- Safety disclaimer before export (check roads, private land, winter conditions; course must be reviewed on site) – EN-13 text.
- Short in-app guide (first-run tour) and link to documentation; attribution and "about" dialog.
