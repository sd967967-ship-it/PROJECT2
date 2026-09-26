# Visual-Regression Plan — SkyTrack (manual until tooling added)

## Matrix (capture phone + desktop, Satellite + Streets)
| View | Checks |
|------|--------|
| Map default | tiles load, 6 markers, layer control top-right, no grey tiles |
| Detail open | all 6 stat boxes aligned, chips wrap, fares table rows, no clipping |
| Search filter | list narrows, count updates, empty query restores |
| 360×640 | panel stacks below map, no h-scroll, controls reachable |
| Zoom 2→10 | markers/arc persist, no tile gaps |

## Later
Add Playwright screenshots + pixel-diff (`tests/visual/*.spec.js`, threshold ≤1%) with satellite tiles mocked (live tiles are non-deterministic). No screenshots committed until then; attach to TEST-REPORT evidence.
