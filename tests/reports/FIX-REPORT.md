# Fix Report — QA findings round (2026-09-27)

## MAP-01 (High): blue globe — FIXED, verified by screenshot
- Root cause: Cesium 1.145 removed the `imageryProvider` Viewer-constructor option; globe had 0 imagery layers (probed `layerCount: 0`, 0 tile requests in 14s+). The earlier `maximumRenderTimeChange` suspicion was wrong — evidence disproved it.
- Fix: `baseLayer: new Cesium.ImageryLayer(provider)` + `layers.add(new Cesium.ImageryLayer(p))` in `public/app.js`; kept `window.__viewer` debug seam.
- Proof: headless-Firefox screenshot shows Google satellite earth (India/Arabia/Asia) with cluster badges; `layerCount: 1`.

## FEED-01 (High): thin swinging fallback — MITIGATED
- Fix: fallback merges all 4 hub regions with dedupe (`server/src/index.js`) instead of rotating one hub; poller skips overlapping cycles (`server/src/ingestion/poller.js` + overlap test).
- Observed: merged fallback count 942 on verification run (vs 11–512 swings). Primary still quota-exhausted; full recovery needs `OPENSKY_USER/PASS` or quota reset. Not yet global — still fallback until primary recovers.

## UX-01 (Medium): marker bunching — FIXED
- 3D: grid clustering by camera height (`clusterBadge`, click zooms into cluster) in `public/app.js`.
- 2D: `Leaflet.markercluster` (CDN, dual-source) in loader + `public/app2d.js`.
- Proof: screenshot shows "6" and "2" cluster badges over India.

## UX-02 (Low): search clipping — FIXED (rail 322px, wrapping layer buttons).

## Cosmetic
- Dossier hint now per-mode ("globe"/"map"). Ion logo left in place (attribution credit line).

## Google satellite default
- Both paths default to Google `lyrs=s/y` tiles; Esri retained as 4th button. Production use of direct Google tiles needs a Maps API key (ToS) — recorded in ARCHITECTURE.md.

## Verification
- Server `npm test`: 11/11. Repo `node tests/run.js`: 36/36. Cycle 12 (single verification run) + screenshots. No app behavior changed beyond the fixes above.
