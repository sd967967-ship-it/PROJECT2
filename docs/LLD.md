# Low-Level Design

> Status 2026-09-27: built. `server/src/*`, `server/data/*`, `server/test/*`, `public/*` live. 10 server + 34 repo tests green.

## Ingestion Module
### Purpose
Single global poller; hides quota/retry/failover. Depth: callers learn one function, get caching + failover free.
### Key files (planned)
| File | Responsibility |
|------|----------------|
| `server/src/ingestion/poller.js` | 10s loop, calls Adapters, writes `snapshot.json` in memory |
| `server/src/ingestion/openskyAdapter.js` | `GET /api/states/all` (+bbox), Bearer auth, maps to `AircraftState` |
| `server/src/ingestion/adsbLolAdapter.js` | `GET /v2/point/[lat]/[lon]/[radius]`, maps to `AircraftState` |
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
| getServices | `getServices(airlineCode) -> {wifi, meals, baggage, entertainment}` | `server/data/airline-services.json` (10 airlines); unknown → `{unknown:true}` |

## Broadcast Module
| Function | Signature | Notes |
|----------|-----------|-------|
| subscribe | `ws {op:"sub", bbox, filters?} → {op:"diff", t, upsert:[], remove:[]}` throttled 5s | Server culls to bbox, caps 800 markers; backpressure: drop tick when `bufferedAmount` >1MB |

## Frontend Module (`public/`)
| Piece | Notes |
|-------|-------|
| `index.html` | globe container, search rail, dossier, ticker; IDs in `tests/unit/landingStatic.test.js` U-STATIC-03 |
| `app.js` | Cesium viewer (Esri/OSM/hybrid), canvas airline badges, flagcdn flags, `/api/snapshot` + ws reconcile, demo fallback |
| `app2d.js` | Leaflet 2D fallback (Esri satellite), same dossier via shared.js, auto-loaded when WebGL/Cesium unavailable |
| `shared.js` | dossier/search/ticker + DEMO + airline/flag/fare helpers shared by 3D and 2D |
| `styles.css` | Space Grotesk + IBM Plex Mono; tokens `--space/--cyan/--amber` |

## Known limitations
No guarantee of every flight (oceans/Mode-S gaps); fares modeled until collector has 2–4 weeks data; routes nullable until schedule source added.
