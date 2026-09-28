# Architecture

## Tech stack
- Backend: Node 22, Express 4, `ws` 8, `satellite.js` 7 (SGP4 propagation for the Space Adapter; MIT), `fast-xml-parser` 5 (Irish Rail XML; MIT, zero-dep) (`server/package.json`, installed 2026-09-27). No other new deps.
- Desktop: Electron 39 + electron-builder (NSIS/portable Windows exe; MIT) as root devDeps (`package.json`, installed 2026-09-29). Backend runs in-process (`desktop/main.js` → `server/src/index.js` `start(port)`); no separate backend step.
- Frontend: `public/` Cesium 1.x CDN (Google satellite default) + flagcdn flags, 3D-only with WebGL diagnostics. No build step.
- Data: JSON-only (`server/data/*.json`); SQLite/Neon only when fare collector lands. Static sets are curated worldwide bundles (100+ ports, 70 rail/bus stops, coordinates ~0.01°); live positions always come from feeds, never the static files.
- Tests: `npm test` in `server/` (21 green, verified 2026-09-27) + root `node tests/run.js` (38 green, verified 2026-09-27).
- E2E: `@playwright/test` devDependency at repo root (`tests/e2e/`, chromium) — real-browser visibility + flows, installed 2026-09-27.

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
| aiscast AIS | Sea Adapter live path (parked until `AIS_URL` set); demo vessels + ports bundled | only when configured |
| CelesTrak TLE | Space Adapter source (verified live keyless 2026-09-27; LEO + GEO/GNSS/weather groups, hourly refresh + `satellite.js`) | no |
| NTES unofficial clients | rail pattern only; live rail parked behind `TRANSIT_URL` (polite polling + cache mandatory) | no |
| Entur JourneyPlanner | live departure boards with realtime flags (verified live keyless 2026-09-27) — Transit Adapter | no |
| Digitraffic rata | live Finland trains (verified live keyless 2026-09-28) — Transit Adapter | no |
| Irish Rail realtime | live Ireland trains (verified live keyless 2026-09-28) — Transit Adapter | no |
| GTFS-RT city feeds | per-city live vehicles (Madison/GZM/DE/FR keyless verified 2026-09-27) | per city — parked until configured |
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
| `POLL_MS` | sky poll interval (default 30000) | env |
| `SEA_POLL_MS` | sea poll interval (default 60000) | env |
| `AIS_URL` / `AIS_KEY` | sea live feed (parked; demo vessels until set) | host env, never repo |
| `STREET_POLL_MS` | streets poll interval (default 30000) | env |
| `TRANSIT_URL` | streets live JSON vehicle feed (parked; demo + stops until set) | host env, never repo |
| `TLE_GROUPS` | CelesTrak groups (default `stations,visual`) | env |
| `TLE_REFRESH_MS` | TLE refresh interval (default 3600000, hourly) | env |
| `AIS_KEY` | aisstream key (parked; aiscast needs none) | host env, never repo |
| `GTFS_RT_URL_<CITY>` | per-city GTFS-RT feed URL (parked until added) | host env / config, never repo |
| `GIT_TERMINAL_PROMPT` | `0` for background jobs | `scripts/auto-sync.ps1` |

## Security headers (no new deps)
Baseline middleware in `server/src/index.js` `build()`: `X-Content-Type-Options`,
`X-Frame-Options: DENY`, tight `Referrer-Policy`, locked `Permissions-Policy`,
and a host-allowlisted CSP. `script-src` keeps `unsafe-inline`/`unsafe-eval` for
the Cesium CDN bundle + inline boot (documented tradeoff); XSS defense itself is
`esc()` on every feed-derived interpolation (`public/shared.js`, search results).
`connect-src`/`worker-src` include unpkg, jsdelivr, and the tile hosts — narrowing
either blacks out the globe or breaks workers (both caught by E2E, cycle-tested).

## Deployment pipeline
See WORKFLOW.md. Single-service deploy: `npm ci && npm start` from `server/`.
