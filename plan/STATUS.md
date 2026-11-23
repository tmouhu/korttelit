# Implementation status (end of M6, 2026-11-23)

Legend: ✅ done · 🟡 partly / unverified · ❌ not done

| Story / enabler | Status | Notes |
|---|---|---|
| US-01…05 paper, scale, frame, rotation, summary | ✅ | Rotation = declination − grid convergence (≈ 12.3° in Helsinki) |
| US-06…11 manual course, edit, numbers, symbols, stats, undo | ✅ | Symbol sizes provisional (EN-08 open). Real-mouse dragging not testable in the dev browser pane |
| US-12 multiple courses | ❌ | "Could" |
| US-13…16 generator, candidates, reachability, quality | ✅ | Verified on recorded Helsinki data; Overpass from a browser unverified (EN-06) |
| US-17 forest controls | 🟡 | Snap to nearest path, no off-path routing |
| US-18 lock / regenerate | 🟡 | "Suggest alternative" missing |
| US-19 settings | 🟡 | Presets missing |
| US-20…22 PDF | ✅ | True-scale A4 verified by measurement of the scale bar; A3/300 dpi and printing untested. Overprint blend, quality (JPEG/PNG) option missing |
| US-23…25 IOF XML, local save | ✅ | Validates against the IOF 3.0 XSD; not opened in Purple Pen |
| US-26…29 descriptions | 🟡 | Auto + sheet + editor + own page ✅; column C, free text, descriptions in standard IOF XML ❌ (not in schema) |
| US-30 fi/en | ✅ | Language switch reloads the page |
| US-31 offline | 🟡 | Service worker + area prefetch + clear; true offline reload untested |
| US-32 warnings, disclaimer, help | ✅ | Coverage and large-image warnings, safety confirm before export, first-run help |
| EN-01 scaffold, CI | 🟡 | Vite/TS/Vitest/CI done; no ESLint/Playwright |
| EN-12 quality gates | 🟡 | Unit/integration tests (36); no visual regression, no Purple Pen fixtures |
| EN-13 licensing | ❌ | Symbol artwork licence open |
| EN-14 budgets | ✅ | Entry chunk 120 kB gz (budget 220) |

## Blocking before a public release
1. Confirm Overpass access from a real browser origin (or choose another source).
2. Verify course symbol sizes against the IOF specs / a Purple Pen print.
3. Resolve the symbol artwork licence.
4. Test on real devices: print at 100 %, A3, Safari, offline reload.
