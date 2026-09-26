# High-Level Design

## System overview
One Node poller fetches live ADS-B snapshots (OpenSky primary, adsb.lol gap-fill over rotating hubs), fuses them into `TrackedFlight` records with nearest-hub/capacity/fares, caches once, and pushes viewport diffs over `ws` to a Cesium 3D frontend with Esri satellite imagery. Static JSON covers airports/capacity/services/countries; fare estimator is modeled day-1. Demo fallback keeps the site presentable when feeds are unreachable.

```
[OpenSky /api/states/all] ─┐
[adsb.lol /v2/point hubs] ─┼→ [Ingestion Module: poll 10s, cache once]
[static JSON data] ────────┘          ↓
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
| Frontend (`public/`) | Cesium globe, badges, dossier, search, ticker | Broadcast + detail API only (never feeds directly) |
| Collector (later) | Daily quote sampling → real fare avgs | Pricing DB → Pricing Module |

## Data stores
- MVP: SQLite file (`server/data/skytrack.db`) or JSON files only — zero cost. See ARCHITECTURE.md for Neon migration.
- Static: `server/data/aircraft-capacity.json`, `server/data/airline-services.json`, airport subset from OpenFlights.

## External services
- OpenSky REST (authenticated free, credit-bucketed) — primary live feed.
- adsb.lol API (free, ODbL, attribution required) — gap-fill Adapter.
- OSM/Carto tiles (free, usage policy + attribution). Esri World Imagery replaces Google tiles (no key, compliant; Google direct tiles violate ToS).
- Vercel (frontend) + Render/Fly free (backend). No AviationStack/AeroDataBox/Skyscanner in MVP.

## Non-functional requirements
- Quota: ≤1 OpenSky states call /10s globally; viewport adsb.lol only on demand, debounced.
- Latency: snapshot→browser ≤6s; click→detail ≤500ms (cache hit).
- Scale MVP: 1 backend instance, 500 visible markers, supercluster; global sweep 60s + viewport refresh 5–10s.
- Security: no secrets in repo; `GIT_TERMINAL_PROMPT=0` pattern for background jobs; env vars for feed creds.
- License/ToS: credit OpenSky + adsb.lol (ODbL) + OSM; no FR24 scraping.
