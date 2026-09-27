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
- Yellow small planes — 2026-09-27 — `#ffd23f` silhouettes, 30px footprint; clustering relaxed (3D groups ≤30 stay planes, 2D radius 25 + decluster at zoom 6); verified 13 yellow planes over India, 0 numbered badges at that zoom.
- Worldwide sweep fallback — 2026-09-27 — 43-cell adsb.lol grid, rotating groups per cycle merged into a 5min hex registry in `index.js`; poll 30s + rate-limit backoff; 8-hub start, politeness throttle on 429; measured: N-America/Europe/Asia/Africa covered, S-America+Oceania pending rotation; cap raised 800→1200.
- Brand logo + theme — 2026-09-27 — `public/logo.svg` (navy gradient + chrome radar plane, favicon too); rail/dossier/ticker washed with the same gradient, silver headings/buttons; verified screenshot with logo + 6 yellow planes worldwide.
- QA rounds 2+3 — 2026-09-27 — 15 cycles (13–27), 825/825 checks green; zoom + favicon fixes verified; feed stable ~800 merged tracks; release verdict conditionally-ready; `tests/reports/QA-FINAL.md`.
- Multimodal plan adopted — 2026-09-27 — docs aligned to `multimodal-space-plan.md`: TrackingSource seam, P6–P9 stories, domain Adapter registry (aiscast/CelesTrak/NTES/GTFS-RT verified keyless), key policy (agent never creates accounts), activation = config-only per WORKFLOW.md.
- All transports shipped — 2026-09-27 — `server/src/tracking/source.js` seam + sea/streets/space adapters, mode switcher, per-domain API + ws, 40 server / 39 repo tests green; sea/streets live paths parked behind `AIS_URL`/`TRANSIT_URL` (demo + ports/stops bundled), space live via CelesTrak + math-only solar.
- Worldwide + deep space round — 2026-09-27 — 100+ ports, 70 rail/bus stops worldwide; TLE movers carry period/inclination/apsides/class/launch year; solar adds Pluto + 5 major moons; 18 human-made craft as vicinity markers (`/api/space/craft`); playwright-best-practices skill installed (86.9K installs, low-risk) for future real-browser E2E.
- Far-belt + solar visibility — 2026-09-27 — TLE groups extended to GEO/GNSS/weather (geo, gps-ops, galileo, glo-ops, goes); solar/craft markers larger with far-visible labels; ◉ solar tour button in Space mode (3D + 2D).
- Real-browser E2E — 2026-09-27 — Playwright suite live (`tests/e2e/flows.spec.js`, desktop + mobile); 5 cycles to green; screenshots proved solar bodies render and caught 3 shipped bugs (airport leak across modes, label pile-ups, mobile tour blocked) — all fixed same turn; see `tests/reports/E2E-CYCLES.md`.

## 🚧 In progress
- Landing polish + airport board (P4) + deploy free host.
- Airport board live on `development` (ticker shows top-3 airport codes w/ track counts) + ticker polish; localhost verified `200` on `/`, `/api/health`, `/api/snapshot`.

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
- 2026-09-27 (earlier): Google-tile plan replaced with Esri (since superseded — Google direct tiles now default per user call, ToS noted); Leaflet plan replaced with Cesium 3D per designer brief.
- 2026-09-27: LLD said 10 airlines — `airlines.json` actually holds 30 (verified by count). ARCHITECTURE test counts updated to 21 server / 38 repo (fresh runs). POLL_MS default corrected 10s→30s; Esri-default references corrected to Google default; TECHFLOW failure/backoff rows corrected to actual behavior.
