# Architecture

## Tech stack
- Backend: Node 22, Express 4, `ws` 8 (`server/package.json`, installed 2026-09-27).
- Frontend: `public/` Cesium 1.x CDN + Esri World Imagery / OSM / Esri reference overlay + flagcdn flags. No build step.
- Data: JSON-only (`server/data/*.json`); SQLite/Neon only when fare collector lands.
- Tests: `npm test` in `server/` (10 green) + root `node tests/run.js` (34 green).

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
| adsb.lol | gap-fill, unfiltered | no (ODbL attribution) |
| OpenFlights data | airports/airlines/routes static | no (bundled subset) |
| Amadeus/AviationStack/Skyscanner | schedules/quotes/booking | no — excluded from MVP |

## Config / env vars
| Var | Purpose | Where set |
|-----|---------|-----------|
| `PORT` | backend port (default 3000) | host env / `.env` (gitignored) |
| `OPENSKY_USER` / `OPENSKY_PASS` | raise OpenSky quota | host env, never repo |
| `SNAPSHOT_TTL_MS` | cache age (default 10000) | env or `server/src/ingestion/poller.js` const |
| `POLL_MS` | poll interval (default 10000) | env |
| `GIT_TERMINAL_PROMPT` | `0` for background jobs | `scripts/auto-sync.ps1` |

## Deployment pipeline
See WORKFLOW.md. Single-service deploy: `npm ci && npm start` from `server/`.
