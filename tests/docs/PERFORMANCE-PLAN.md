# Performance Plan — SkyTrack

## Budgets (landing MVP, broadband desktop)
| Metric | Budget | How measured (manual now) |
|--------|--------|---------------------------|
| Static server first paint | ≤2s | devtools, empty cache, 3 runs |
| Map interactive (tiles+6 markers) | ≤3s | devtools performance |
| Search filter keystroke | ≤50ms | 6-row mock; note only |
| Detail panel open | ≤500ms | click → paint |
| `public/app.js` size | ≤25KB | `tests/perf/budgets.test.js` asserts |
| Markers smooth | no jank at 500 markers | later (mock 500-row fixture) |

## Later (with backend)
- Snapshot→browser p95 ≤6s; ws diff cadence 5s; memory flat over 30min soak; low-end Android + 3G profile logged.
- Record in TEST-REPORT.md per cycle; flag regressions >20% vs prior cycle. No perf-code changes in test task.
