# Architecture

## Tech stack
- Backend: Node 22, Express 4, `ws` 8 (`server/package.json`, installed 2026-09-27). Planned: `satellite.js` (MIT, TLE propagation) — record here before install per AGENTS.md.
- Frontend: `public/` Cesium 1.x CDN (Google satellite default) + Leaflet 2D fallback + markercluster + flagcdn flags. No build step.
- Data: JSON-only (`server/data/*.json`); SQLite/Neon only when fare collector lands.
- Tests: `npm test` in `server/` (21 green, verified 2026-09-27) + root `node tests/run.js` (38 green, verified 2026-09-27).

## Environments
- dev: `http://localhost:3000` (`npm start` in `server/`), serves API + `public/`.
- prod: backend single service (Render/Fly free) serving API + static; optional Vercel for static later.

## Infra & hosting (all free)
- Frontend: Vercel free (or same Render service for single-origin simplicity).
- Backend: Render free 750h (sleeps; UptimeRobot ping) or Fly free. One instance to preserve single-poller invariant.
- Imagery: Google satellite default (direct tiles; production needs Maps API key), Esri World Imagery + OSM + Esri reference as compliant free alternatives (layer buttons).
- No Docker required for MVP.

## Third-party services & why
| Service | Why | Key needed MVP? |
|---------|-----|-----------------|
| OpenSky REST | primary live positions | optional (anonymous works, auth raises quota) |
| adsb.lol | 43-cell sweep fallback, unfiltered, no key (ODbL attribution) | no |
| aiscast AIS | keyless vessels bbox/stream (verified live 2026-09-27) — Sea Adapter | no |
| CelesTrak TLE | keyless satellite elements (verified live 2026-09-27) — Space Adapter | no |
| NTES unofficial clients | keyless rail status/boards (unofficial: polite polling + cache mandatory) | no |
| GTFS-RT city feeds | per-city live vehicles (Madison/GZM/DE/FR keyless verified 2026-09-27) | per city, mostly none |
| ADSB One (`api.adsb.one`) | tried 2026-09-27: Cloudflare 403 even server-side | pending arrangement |
| airplanes.live | tried 2026-09-27: 403, requires contacting them (feeder access) | pending |
| adsb.fi | tried 2026-09-27: no compatible v2 endpoint found | pending |
| OpenFlights data | airports/airlines/routes static | no (bundled subset) |
| Amadeus/AviationStack/Skyscanner | schedules/quotes/booking | no — excluded from MVP |

## Config / env vars
| Var | Purpose | Where set |
|-----|---------|-----------|
| `PORT` | backend port (default 3000) | host env / `.env` (gitignored) |
| `OPENSKY_USER` / `OPENSKY_PASS` | raise OpenSky quota | host env, never repo |
| `POLL_MS` | poll interval (default 30000) | env |
| `AIS_KEY` | aisstream key (parked; aiscast needs none) | host env, never repo |
| `GTFS_RT_URL_<CITY>` | per-city GTFS-RT feed URL (parked until added) | host env / config, never repo |
| `GIT_TERMINAL_PROMPT` | `0` for background jobs | `scripts/auto-sync.ps1` |

## Deployment pipeline
See WORKFLOW.md. Single-service deploy: `npm ci && npm start` from `server/`.
