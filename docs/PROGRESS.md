# Progress Log

_Last updated: 2026-09-27_

## ✅ Done
- Repo init + multi-PC sync — 2026-09-26 — `scripts/auto-sync.ps1:1`, `start-sync.bat:1`, `README.md:23`, commits `14c9e0c`, `2633e2a`, `324bd89`, pushed `main→origin/main`.
- SkyTrack decisions locked — 2026-09-26 — capacity not boarded, modeled fares not booking, best-effort global free, Node+`ws` (see PRD.md).
- Docs system created — 2026-09-26 — this `/docs` set; app code still frozen.
- Test system scaffolded — 2026-09-27 — `tests/` (node:test suites, mocks, fixtures, docs, reports, run.js) + `.github/workflows/qa-tests.yml`; app code untouched, suite NOT run yet.
- Full build v0.1 — 2026-09-27 — `server/` (ingestion/fusion/capacity/pricing/services/broadcast, live-verified 10.7k tracks) + Cesium 3D frontend (Esri satellite, badges, flags) + `server/test/` (10 green); repo suites updated to Cesium contracts (34 green); see LLD.md.
- WebGL fallback — 2026-09-27 — pinned Cesium 1.145 + dual-CDN loader with diagnostics; automatic Leaflet 2D satellite fallback (`app2d.js`) sharing `shared.js` dossier; machine driver Intel 27.20.100.8935 (2020) likely blocklisted — site now runs regardless.
- Overlay-specifity bug — 2026-09-27 — `#nogl {display:grid}` overrode `[hidden]` so the fallback box covered working maps; fixed with `#nogl[hidden]{display:none}`; verified via headless-Firefox screenshots of both paths.
- QA 10 cycles — 2026-09-27 — 460/460 automated checks green; 2 High bugs (FEED-01 exhausted primary→thin swinging fallback; MAP-01 Esri tiles never requested→blue globe), 1 Medium (marker bunching), 1 Low + 2 cosmetic; verdict not-ready-for-release; full report `tests/reports/QA-10-CYCLES.md`; no app code changed.
- Fix round — 2026-09-27 — MAP-01 root cause was removed `imageryProvider` ctor option (0 layers), fixed with `baseLayer: new ImageryLayer()`; FEED-01 fallback now merges all 4 hubs + no-overlap guard; grid clustering (3D) + markercluster (2D); Google satellite default with ToS note; fixes verified by screenshot + cycle 12; see `tests/reports/FIX-REPORT.md`.
- Feeds verdict — 2026-09-27 — probed airplanes.live (403 needs feeder arrangement), ADSB One (Cloudflare 403), adsb.fi (no compatible endpoint); only adsb.lol works keyless, stays as fallback; verdicts in ARCHITECTURE.md.
- Plane markers — 2026-09-27 — singles render as heading-rotated plane silhouettes (canvas billboard 3D, SVG 2D); numbered badges kept for clusters only; verified 402-track Europe screenshot.

## 🚧 In progress
- Landing polish + airport board (P4) + deploy free host.

## ⏭️ Next up (done, kept for history)
1. ~~Lift code freeze → scaffold `server/`~~ done 2026-09-27.
2. ~~Phase 1: snapshot endpoint + map~~ done (Cesium instead of Leaflet).
3. ~~Phase 2: `GET /api/flights/:hex` detail~~ done.
4. Phase 3–5 remaining: airport board, deploy free.

## 🚫 Blockers / open questions
- Render vs Fly free host — default Render + ping unless Fly chosen.
- SQLite file vs JSON-only start — default JSON-only, SQLite when collector lands.
- OpenSky auth creds — optional; anonymous works with lower quota.

## 🔧 Corrections
- 2026-09-27: Google-tile plan replaced with Esri World Imagery (direct Google tiles violate ToS; Esri needs no key). Leaflet plan replaced with Cesium 3D per designer brief.
