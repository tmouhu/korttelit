# EN-08 Spike status – IOF course symbol sizes (2026-11-23): NOT VERIFIED

Attempted: web search, and the O-Map Wiki symbol pages (703 control point, 701 start). The wiki blocks automated fetching (403 for the fetch agent); in the browser it loads but lists only "Footprint: 75 m in diameter" for the control circle, with no millimetre sizes. Note that 75 m would be 5 mm at 1:15000, which differs from the 6.0 mm used as a provisional default, so the 6.0 mm value must be checked.

Implemented anyway, behind one table: `src/core/symbols.ts` (`BASE`, `SCALE_FACTOR`). Provisional values:
circle outer Ø 6.0 mm, line 0.35 mm, start triangle side 7.0 mm, finish Ø 7.0/5.0 mm, number height 4.0 mm, white halo 1.5 mm (user requirement).

To close: read ISOM 2017-2 and ISSprOM 2019-2 PDFs (IOF mapping page) or compare against a Purple Pen/OCAD print at the same scale, then set `BASE` and `SCALE_FACTOR` and add a test asserting the table.
