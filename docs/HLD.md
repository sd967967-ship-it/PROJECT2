# High-Level Design

## System overview
One Node poller per domain fetches live snapshots through `TrackingSource` Adapters (sky: OpenSky/adsb.lol; sea: keyless AIS; streets: NTES/GTFS-RT per city; space: CelesTrak TLE), fuses them into domain records, caches once, and pushes viewport diffs over `ws` to one shared UI (globe, dossier, search, ticker, trails, follow). A mode switcher swaps the Adapter, never the UI. Static JSON covers airports/capacity/services/countries/stops; fare estimator is modeled day-1. Demo fallback keeps the site presentable when feeds are unreachable. Space gets a dedicated solar scene (Sun + 8 planets + major moons, math-only) with a live TLE belt.

```
[OpenSky /api/states/all] ─┐ (global when healthy)
[adsb.lol sweep 43 cells] ─┼→ [Ingestion Module: poll 30s, cache once]
[static JSON data] ────────┘          ↓
                    [Registry: hex-merged, 5min TTL → near-worldwide]
                                          ↓
                    [Fusion: dedupe/nearest-hub] → [Capacity] → [Pricing estimator] → [Services]
                                          ↓
                    [Broadcast Module: ws subscribe(bbox), 5s diff push]
                                          ↓
                    [public/ Cesium globe + dossier, requestRenderMode]
```

## Components
| Component | Responsibility | Talks to |
|-----------|---------------|----------|
| Ingestion Module | Poll feeds once globally, normalize to `AircraftState`, cache snapshot | OpenSky, adsb.lol → Fusion |
| Fusion Module | Dedupe by hex, smooth speed, great-circle ETA/dist/hours | Ingestion → Broadcast, Capacity, Pricing |
| Capacity Module | Type → seats lookup + load band | Fusion → detail payload |
| Pricing Module | Modeled fare avg/min/max per class + confidence | Fusion (distance) → detail payload |
| Services Module | Airline → wifi/meals/baggage/entertainment | Detail payload |
| Broadcast Module | `ws` viewport subscribe + diff push, backpressure | Fusion cache → browsers |
| TrackingSource Module (planned) | `getSnapshot(domain, bbox?) -> movers[]`; one seam, Adapters per domain | Adapters → Fusion/UI |
| Space Module (planned) | TLE fetch/cache + propagation + solar scene + satellite dossier | CelesTrak → globe/UI |
| Frontend (`public/`) | Cesium globe w/ automatic Leaflet 2D fallback, dossier, search, ticker | Broadcast + detail API only (never feeds directly) |
| Collector (later) | Daily quote sampling → real fare avgs | Pricing DB → Pricing Module |

## Data stores
- MVP: SQLite file (`server/data/skytrack.db`) or JSON files only — zero cost. See ARCHITECTURE.md for Neon migration.
- Static: `server/data/aircraft-capacity.json`, `server/data/airline-services.json`, airport subset from OpenFlights.

## External services
- OpenSky REST (authenticated free, credit-bucketed) — primary live feed.
- adsb.lol API (free, ODbL, attribution required) — 43-cell sweep fallback Adapter.
- aiscast AIS (verified keyless 2026-09-27: live vessels bbox endpoint) — Sea Adapter source.
- CelesTrak TLE (verified keyless 2026-09-27, fresh epochs) — Space Adapter source.
- NTES unofficial clients (keyless, polite polling + cache mandatory) — Rail Adapter pattern.
- GTFS-RT per-city registry (Madison/GZM/German/French keyless feeds verified 2026-09-27) — Streets live vehicles; static stops worldwide via open GTFS data.
- Imagery: Google satellite default (direct tiles; production needs Maps API key), Esri World Imagery + OSM selectable (compliant free options).
- Vercel (frontend) + Render/Fly free (backend). No AviationStack/AeroDataBox/Skyscanner in MVP.

## Non-functional requirements
- Quota: ≤1 OpenSky states call /30s globally with exponential backoff to 10min on 429; fallback sweep ≈11 adsb.lol cells per cycle with 400ms gaps.
- Latency: snapshot→browser ≤6s (fallback sweep accumulates worldwide over ~2min); click→detail ≤500ms (cache hit).
- Scale MVP: 1 backend instance, 500 visible markers, supercluster; global sweep 60s + viewport refresh 5–10s.
- Security: no secrets in repo; `GIT_TERMINAL_PROMPT=0` pattern for background jobs; env vars for feed creds.
- License/ToS: credit OpenSky + adsb.lol (ODbL) + OSM; no FR24 scraping.
