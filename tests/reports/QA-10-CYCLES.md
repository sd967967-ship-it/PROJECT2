# QA Final Report — 10 cycles, SkyTrack v0.1 (2026-09-27)

## 1. Executive summary
Automated suites are fully green in all 10 cycles (460/460 checks). No JS errors, no failed requests, no secrets, API contracts intact. Two High bugs found (both reproducible 10/10): feed stuck in thin regional fallback with wild count swings (the reported "bunch"), and Cesium globe never loading satellite tiles (the reported "blue earth"). **Not ready for release** until FEED-01 and MAP-01 are fixed; no app code was changed during cycles per protocol.

## 2. Total cycles completed
10/10, all to completion. Evidence: `tests/reports/cycles/cycle-01..10.json` (+ `.md`), screenshots `shot-01/05/10.png`. Harness: Temp `pw-check/cycle.js` (instrumented Firefox, cache-served API reads — zero feed quota spent by testing).

## 3. Overall pass/fail
- `node tests/run.js`: 36/36 every cycle (360 total). Server `npm test`: 10/10 every cycle (100 total).
- Syntax sweep 29 files: clean. API health/snapshot/detail/404: pass every cycle. Browser: zero JS errors, zero failed requests every cycle.

## 4. Bugs by severity
High 2, Medium 1, Low 1, Cosmetic 2.

## 5. Confirmed bugs
**BUG-FEED-01 (High): primary feed exhausted, permanent fallback.**
Steps: run server, `GET /api/snapshot` repeatedly. Expected: `src:live`, ~10k global tracks (verified earlier same day: 10,787). Actual: `src:fallback` in 10/10 cycles; counts swung 11↔512 between consecutive 10s polls (11,512,19,506,509,21,12,504,441,11). Cause: OpenSky anonymous quota exhausted (heavy same-day testing); hub-rotation fallback samples one 250nm region at a time. Effect: world map shows a small regional "bunch" that jumps every poll. Reproducible, not flaky.
**BUG-MAP-01 (High): Esri satellite tiles never requested → blue globe.**
Steps: load `/`, wait 20s. Expected: satellite earth. Actual: solid blue disc in screenshots cycles 1/5/10; resource timing shows 0 arcgisonline requests (only unpkg). No console errors. Suspected: `requestRenderMode:true` + `maximumRenderTimeChange:Infinity` stalls Cesium tile pipeline. Reproducible 10/10.
**BUG-UX-01 (Medium): fallback tracks cluster ("bunch").** No declustering at global zoom; planned supercluster never implemented for Cesium path. Visible cycle 5 (IGO/THY pile-up).
**BUG-UX-02 (Low): search input text clipped** at 300px rail (screenshots).

## 6. Intermittent / flaky
- 3D billboards visible in cycle 5 shot, absent in cycle 10 shot at similar counts (~500). Suspected render-zoom interaction; needs zoomed follow-up. Single occurrence each way — unconfirmed.
- Page-count vs API-count anti-correlation within cycles is a timing artifact (reads ~40s apart across 10s polls), not a sync bug.

## 7. Minute/cosmetic issues
- Dossier default text says "globe" also in 2D mode. Cesium ion logo bottom-left though no ion assets used.

## 8. Performance findings
Not measured (no timing harness; manual only). Snapshot age 2–14s (one 14s). Page interactive <20s in automation. Budgets file-size only: frontend JS ~25KB total, green.

## 9. Accessibility findings
Static checks green (lang, names, focus order, badge). Manual screen-reader/keyboard/contrast/targets NOT run — gap.

## 10. Security/privacy findings
Secrets sweep green all cycles. Browser never calls feeds directly (verified in code + network). `innerHTML` used only with trusted data; search uses `textContent`-safe paths — XSS probe deferred to E2E phase.

## 11. Regression risks
Feed-source changes (OpenSky schema, adsb.lol limits) break fusion silently into fallback; add contract tests against recorded fixtures. Tile-host changes break imagery with zero console errors (observed) — needs a tile-watchdog test.

## 12. Coverage gaps
E2E Playwright (not installed in repo), axe-core, real-device/small-screen, slow-network profile, perf timings, lint/typecheck (none configured).

## 13. Blockers / limitations
No MCP servers exist in this environment; desktop-browser bridge disconnected — cycles used headless instrumented Firefox instead. User's open Firefox window was never directly driven.

## 14. Fix recommendations (priority order, NOT applied)
1. MAP-01: drop `maximumRenderTimeChange:Infinity` (keep `requestRenderMode`), verify tiles flow.
2. FEED-01: add `OPENSKY_USER/PASS`, lengthen poll to 15–30s anonymous, widen fallback (multi-hub merge).
3. UX-01: billboard clustering/cap-per-viewport. 4. Google-satellite layer per user request (note ToS; keep Esri default or switch default on explicit approval).

## 15. Release assessment
**Not ready for release.** Reasons: world map shows regional bunches on exhausted quota (FEED-01) and a blue untextured globe (MAP-01) — the two headline features. Automated quality gates all pass; product behavior does not yet meet PRD P1/P3.
