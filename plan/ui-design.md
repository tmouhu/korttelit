# UI design plan – "Korttelit"

**Subject:** a planning tool for Finnish club coaches making winter-training street orienteering courses. The map is the product; the interface should stay out of its way and look like it belongs to orienteering.

**Idea worth remembering (the one bold move):** the brand mark and every control badge reuse the IOF course symbols (start triangle, control circle, finish double circle) in the course purple, so the UI and the printed map speak the same visual language. The wordmark sets the "o" of *Korttelit* as a control circle.

## Tokens
| Token | Light | Dark | Use |
|---|---|---|---|
| Ink | `#15222E` | `#15222E` | header, text on light |
| Snow | `#F2F5F7` | `#1A2530` | sidebar background |
| Paper | `#FFFFFF` | `#212E3A` | fields, toolbar |
| Frost line | `#DDE5EB` | `#2F3E4B` | dividers, outlines |
| Course purple | `#B3128C` | `#B3128C` (text `#E36CCB`) | the only accent: primary actions, selection, control badges |
| Flag orange | `#E8590C` | `#F4803A` | warnings and destructive actions only |

**Type:** system stack (`Avenir Next`, `Segoe UI Variable`, `system-ui`) – no web fonts, so it works offline. Wordmark 800 weight, tight tracking; UI 13–14 px; tabular figures for all numbers.

**Layout**
```
┌────────────────────────────────────────────────────────┐
│ ◯▷ Korttelit  korttelisuunnistus      [fi] [Ohje] [Lataa PDF] │  ink bar
├──────────────┬─────────────────────────────────────────┤
│ Kartta Rata  │   ┌ ▷ ◯ ◎ ⌖ │ ↶ ↷ ┐  floating toolbar      │
│ Luo Kuvaus   │                                          │
│ Vie          │              MAP                         │
│ ─────────    │                                          │
│ panel        │   toast (status)                         │
└──────────────┴─────────────────────────────────────────┘
```
Left-aligned content, one column in the panel, flat sections separated by hairlines (no card grid). Below 760 px the panel becomes a bottom sheet.

**Principles**
1. The primary action (Download PDF) lives in the header at all times.
2. Drawing tools sit on the map; settings live in tabs by task (Map · Course · Generate · Descriptions · Export).
3. Purple means "your course"; orange means "careful". No other accents.
4. Status messages are toasts over the map, not text lost in the sidebar.
5. Focus rings, 44 px touch targets for toolbar buttons, `prefers-reduced-motion` respected.

**Review against the brief:** a first pass (dark sidebar, neon accent, rounded cards) was the generic "map dashboard" look; replaced by the light sidebar (the Mapant map is dark and saturated, so a calm light panel gives contrast), one accent taken from the domain, and flat sections instead of cards.
