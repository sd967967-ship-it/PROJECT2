# Architecture

## Tech stack
- Backend: Node 22, Express, `ws`, `axios` (planned `server/package.json`). No new dep without noting here.
- Frontend MVP: static `public/` Leaflet 1.9 + OSM/Carto tiles + supercluster via CDN. React+Vite migration later (same `ws` contract).
- Data: SQLite file or JSON-only MVP; static `server/data/*.json`.
- Tests: `node --test` under `server/test/`.

## Environments
- dev: `http://localhost:3000` (`npm start` in `server/`), serves API + `public/`.
- prod: backend single service (Render/Fly free) serving API + static; optional Vercel for static later.

## Infra & hosting (all free)
- Frontend: Vercel free (or same Render service for single-origin simplicity).
- Backend: Render free 750h (sleeps; UptimeRobot ping) or Fly free. One instance to preserve single-poller invariant.
- Tiles: OSM standard / Carto light, attribution required, respect tile usage policy.
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
