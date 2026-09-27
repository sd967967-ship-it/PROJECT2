# E2E Cycles — real-browser verification (Playwright + Chromium, 2026-09-27)

Command: `npx playwright test -c tests/e2e/playwright.config.js` (desktop 1440×900 + mobile 360×640).
Console-error guard fails on any pageerror/console error; Cesium's sandboxed
about:blank InfoBox iframe is filtered as benign (verified app-side, not a bug).

## Cycle 1 (desktop, 7 run) — 0 pass
- Console guard tripped on the benign sandboxed-iframe message on every test.
- E-MODES-01: strict-mode violation — "Streets" matches the mode button AND the
  imagery-layer button. Scoped all mode locators to the Tracking-mode group.

## Cycle 2 (desktop, 7 run) — 7 pass
- Screenshots proved solar bodies render (Uranus/Callisto/Mars labels + 873
  tracked) but showed three real bugs (see cycle 3 fixes).

## Bugs found via screenshots (all fixed same turn)
1. Airport hub dots + stale sky counts leaked into Sea/Streets/Space modes.
   Fix: `ent.show`/layer toggle per domain in `setDomain`/`setDomain2d`.
2. Craft + solar labels piled unreadably at Mars/Sun subpoints.
   Fix: craft labels only under 4,000 km viewing distance; dossier resets per
   domain on switch (`resetDossier`); sky-only fine print no longer leaks.
3. Mobile: bottom-sheet dossier covered zoom/tour controls (tour unclickable).
   Fix: ≤760px zoomctl becomes a row above the dossier.

## Cycle 3 (desktop E-SPACE-01) — pass, Mars pile resolved.
## Cycle 4 (mobile full, 7 run) — 6 pass, E-SPACE-02 failed on bug 3, then fixed.
## Cycle 5 (mobile E-SPACE-02 ×2) — pass; +/−/◉ all tappable above dossier.

## Cycle 6 (3D-scene + CSP round)
- E-SPACE-03 wrote the missing scene-activation test: caught our own CSP
  blocking Cesium workers + tile hosts (black globe, render stopped).
- Fixed `connect-src`/`worker-src` twice, each verified by re-run; added an
  in-page tile-fetch assertion to E-APP-01 and first-party requestfailed guard.
- Cycle 6 desktop full: 11/11 green.

## Cycle 7 (council + live-rail round)
- Quakes/events/Kp/fireballs pollers, Entur boards (verified live), Finland +
  Ireland live rail (verified live: 114 FI + 37 IE trains), rail/metro/tram/bus
  split with filter + mode-grouped boards, layer panel wiring, terminator,
  weather readout, solar animation + bodies table, XSS/project hardening.
- Desktop 14/14; mobile 9/14 → fixed rail/dossier overlap, search-driven board
  flow, stale-click notice + retry, keyboard search results.
- Mobile re-run: 14/14.

## Residual notes (not bugs)
- First load ~50–80s under SwiftShader (Cesium CDN + software GL compile);
  subsequent loads ~10–25s. Device-only cost, no app change.
- E2E needs the app server on :3000 (auto-reused via webServer config).
