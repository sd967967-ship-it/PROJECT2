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
