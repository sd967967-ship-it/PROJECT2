# Progress Log

_Last updated: 2026-09-26_

## ✅ Done
- Repo init + multi-PC sync — 2026-09-26 — `scripts/auto-sync.ps1:1`, `start-sync.bat:1`, `README.md:23`, commits `14c9e0c`, `2633e2a`, `324bd89`, pushed `main→origin/main`.
- SkyTrack decisions locked — 2026-09-26 — capacity not boarded, modeled fares not booking, best-effort global free, Node+`ws` (see PRD.md).
- Docs system created — 2026-09-26 — this `/docs` set; app code still frozen.
- Test system scaffolded — 2026-09-27 — `tests/` (node:test suites, mocks, fixtures, docs, reports, run.js) + `.github/workflows/qa-tests.yml`; app code untouched, suite NOT run yet.

## 🚧 In progress
- Landing page MVP — `public/index.html:1`, `public/app.js:12`, `public/styles.css:1` — Leaflet draggable satellite/hybrid/streets layers + mock snapshot + backend ws hook, pending browser check.

## ⏭️ Next up
1. Lift code freeze → scaffold `server/` (poller, fuse/geo/eta, capacity/pricing/services JSON, broadcast, `index.js`) + `server/test/`.
2. Phase 1: snapshot endpoint + `public/` Leaflet map, 500-cap, viewport query.
3. Phase 2: `GET /api/flights/:hex` detail (speed/ETA/hours/capacity/fares/services/arc).
4. Phase 3–5: ws diff-push, airport board, search, deploy free.

## 🚫 Blockers / open questions
- Render vs Fly free host — default Render + ping unless Fly chosen.
- SQLite file vs JSON-only start — default JSON-only, SQLite when collector lands.
- OpenSky auth creds — optional; anonymous works with lower quota.

## 🔧 Corrections
- None yet. If a doc contradicts code, fix doc here same turn.
