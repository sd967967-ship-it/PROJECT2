# Low-Level Design

> Status 2026-09-27: built. `server/src/*`, `server/data/*`, `server/test/*`, `public/*` live. 10 server + 34 repo tests green.

## Ingestion Module
### Purpose
Single global poller; hides quota/retry/failover. Depth: callers learn one function, get caching + failover free.
### Key files (planned)
| File | Responsibility |
|------|----------------|
| `server/src/ingestion/poller.js` | 30s loop (env `POLL_MS`), rate-limit backoff 1–10min (primary skipped, keyless sweep continues), no-overlap guard, writes snapshot in memory |
| `server/src/ingestion/openskyAdapter.js` | `GET /api/states/all`, Basic auth from env, maps to `AircraftState` |
| `server/src/ingestion/adsbLolAdapter.js` | `WORLD_GRID` 43 cells + `fetchSweep` (rotating groups, 400ms gaps); registry merge lives in `index.js` |
### Public interfaces
| Function | Signature | Input | Output | Notes |
|----------|-----------|-------|--------|-------|
| getSnapshot | `getSnapshot(bbox?) -> {t, states}` | `{lamin,lomin,lamax,lomax}` optional | `{t: epochMs, states: AircraftState[]}` | Serves cache if age <10s; else polls primary then fallback |
### Data schema
`AircraftState {hex, callsign, lat, lon, altM, velMs, hdg, vsMs, onGround, seenMs, src}`. Units: degrees, metres, m/s.
### Edge cases
429/quota → serve stale ≤60s + backoff; empty bbox → clamp to ≤20°×30°; auth missing → anonymous with lower rate + warn.
### TODOs
OpenSky Bearer refresh; feeder-key support for adsb.lol later.

## Fusion Module
### Purpose
Dedupe + derive ETA/distance/hours. Internal seams: `greatCircle()`, `etaUtc()` unit-tested.
### Key files
| File | Responsibility |
|------|----------------|
| `server/src/fusion/fuse.js` | dedupe by hex, prefer freshest `seenMs` |
| `server/src/fusion/geo.js` | haversine, bearing, great-circle arc points |
| `server/src/fusion/eta.js` | ETA + elapsed/remaining hours with speed smoothing |
### Public interfaces
| Function | Signature | Input | Output | Notes |
|----------|-----------|-------|--------|-------|
| fuse | `fuse(states, routes?) -> TrackedFlight[]` | states + optional route map | fused tracks | drops stale >60s, smooths vel with EMA α=0.3 |
### Data schema
`TrackedFlight {hex, callsign, lat, lon, velKmh, hdg, origin?, dest?, distRemainKm, etaUtc?, elapsedH?, remainH?, capacity?, fares?, services?}`. `origin/dest` nullable → UI shows "position-only".
### Edge cases
vel=0 → ETA null; antipodal route → clamp arc; missing route → distance/ETA omitted, not zero.

## Capacity Module
| Function | Signature | Notes |
|----------|-----------|-------|
| getCapacity | `getCapacity(icaoType?) -> {seats, source, confidence}` | `server/data/aircraft-capacity.json` (~40 types); fallback by wake category; UI shows `189 seats · typical 80–85% (~155)` labeled estimate |

## Pricing Module
| Function | Signature | Notes |
|----------|-----------|-------|
| getFareAvg | `getFareAvg(origin, dest, airline?) -> {eco,prem,biz,first}` each `{avg,min,max,n,confidence}` | Estimator Adapter: `distKm*base*classMult*airlineIdx`; base=$0.12/km; mult 1/1.4/2.5/4.0; confidence `low/modeled`. Collector Adapter later writes real samples to SQLite. |

## Services Module
| Function | Signature | Notes |
|----------|-----------|-------|
| getServices | `getServices(airlineCode) -> {wifi, meals, baggage, entertainment}` | `server/data/airlines.json` (30 airlines, verified 2026-09-27); unknown → `{unknown:true}` |

## TrackingSource Module (built 2026-09-27, per multimodal plan)
| Function | Signature | Notes |
|----------|-----------|-------|
| getSnapshot | `getSnapshot(domain, bbox?) -> {t, src, movers[]}` | `movers[] = {id, domain, kind, lat, lon, altM, velKmh, hdg, label, meta, src}`; one seam for sky/sea/streets/space; see `server/src/tracking/source.js` |
| deriveSrc | `deriveSrc(cacheSrc, states) -> live\|fallback\|demo\|none` | live only on primary success; demo when every row is demo or cache empty |

## Domain Adapters (registry grows by config, not code)
| Adapter | Source | Key? | Status |
|---------|--------|------|--------|
| `adsb` | OpenSky + adsb.lol sweep | no (auth raises quota) | exists |
| `tle` | CelesTrak stations+visual, hourly refresh + `satellite.js` | no (verified live keyless 2026-09-27) | exists (movers carry NORAD id, inclination, period, apsides, class, launch year) |
| `craft` | curated `server/data/craft.json` (18 human-made deep-space craft) as labeled vicinity markers on target subpoints | no | exists |
| `ais` | AIS live path behind `AIS_URL`/`AIS_KEY`; demo vessels + 100+ worldwide ports bundled | only when configured | parked-config + demo |
| `rail`/`transit` | generic JSON vehicle feed behind `TRANSIT_URL`; demo vehicles + 70 worldwide rail/bus stops bundled | only when configured | parked-config + demo |
| `gtfs-rt` | per-city registry (Madison/GZM/DE/FR verified) | per city, mostly none | parked |
| `gtfs-static` | bundled `server/data/stops.json` worldwide rail/bus hubs | no | exists |
| `solar` | Kepler math + lunar theory, zero network: Sun, Moon, 8 planets, Pluto, 5 major moons | no | exists |

## Broadcast Module
| Function | Signature | Notes |
|----------|-----------|-------|
| subscribe | `ws {op:"sub", bbox, filters?} → {op:"diff", t, upsert:[], remove:[]}` throttled 5s | Server culls to bbox, caps 1200 markers; backpressure: drop tick when `bufferedAmount` >1MB |

## Frontend Module (`public/`)
| Piece | Notes |
|-------|-------|
| `index.html` | globe container, search rail, dossier, ticker; IDs in `tests/unit/landingStatic.test.js` U-STATIC-03 |
| `app.js` | Cesium viewer (Esri/OSM/hybrid), canvas airline badges, flagcdn flags, `/api/snapshot` + ws reconcile, demo fallback |
| `app2d.js` | Leaflet 2D fallback (Esri satellite), same dossier via shared.js, auto-loaded when WebGL/Cesium unavailable |
| `shared.js` | dossier/search/ticker + DEMO + airline/flag/fare helpers shared by 3D and 2D |
| `styles.css` | Space Grotesk + IBM Plex Mono; tokens `--space/--cyan/--amber` |

## Known limitations
No guarantee of every flight (oceans/Mode-S gaps); fares modeled until collector has 2–4 weeks data; routes nullable until schedule source added. Sea/streets coverage follows volunteer/open feeds per region; rail positions are station-anchored (NTES), not GPS. Plan-file note: `multimodal-space-plan.md` graded ships/rail as key-gated before the 2026-09-27 keyless verification — the table above supersedes it.
