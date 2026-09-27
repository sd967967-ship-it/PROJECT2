# PRD — SkyTrack

## Problem
Aviation enthusiasts and travelers want a fast, live, FlightRadar24-style world map with per-flight detail, without paying for commercial feeds on day 1.

## Target user
- V1: single builder + demo viewers on desktop/mobile browsers.
- Later: multi-user with saved flights.

## Solution (MVP scope, 100% free)
Live map + detail panel served from one free backend + one free frontend host. Decisions locked 2026-09-26:
1. Capacity shown (aircraft seats + typical-load band), never fake live boarded count.
2. Best-effort global free coverage (not guaranteed every flight).
3. Avg fare per class via modeled estimator day-1 (no booking links in MVP).
4. Stack: Node + Express + `ws` backend; Cesium 3D globe + Google satellite frontend (WebGL required; guided diagnostics when unavailable).
5. Multimodal (adopted 2026-09-27, see `multimodal-space-plan.md`): one `TrackingSource` seam, Adapters per domain. Space + solar ship keyless; ships via keyless AIS, trains via keyless NTES clients, metro/bus per open city; key-gated sources stay parked until the user pastes keys (agent never creates accounts).
6. Live-data layers (user-directed 2026-09-28): hazards (USGS, EONET), atmosphere (Open-Meteo, terminator), space weather (SWPC, CNEOS), and a layer-status system — all keyless documented public feeds, same compliance rules (attribution, quota, cache, no fake live).

| ID | As a... | I want to... | So that... | Status |
|----|---------|--------------|------------|--------|
| P1 | viewer | see live aircraft on a world map with search by callsign/route/airport | I can find flights fast | done 2026-09-27 |
| P2 | viewer | click a plane → speed, ETA, flying hours, path, capacity, services, fare avgs | I get full context in one panel | done (ETA/fares only when route known; else position-only) |
| P3 | viewer | filter to my viewport with smooth markers | map stays fast globally | done (1200 cap + clustering + requestRenderMode) |
| P4 | viewer | see airport departures/arrivals derived from live tracks | I can browse hubs | partial (nearest-hub per track; board pending) |
| P5 | builder | run everything on free tiers with no API keys | cost stays zero | done |
| P6 | viewer | track satellites live + tour the solar system with moons | space is as explorable as sky | done 2026-09-27 (keyless TLE belt with per-sat details + Sun/Moon/planets/Pluto/5 moons + 18 crewed-craft vicinity markers; demo elements offline) |
| P7 | viewer | track ships live worldwide | sea joins the same globe UI | done 2026-09-27 (demo + 100 worldwide ports; live AIS parked behind `AIS_URL`) |
| P8 | viewer | track trains live + browse worldwide transit stops | ground joins the same UI | live 2026-09-28 (Finland + Ireland rail live, Norway boards live; rail/metro/tram/bus split; other regions demo/parked) |
| P9 | viewer | switch Sky/Sea/Streets/Space modes without relearning the UI | one app for every domain | done 2026-09-27 |

## Out of scope (explicitly not building yet)
- Guaranteed every-flight-in-world coverage (needs paid feed/feeders; see HLD.md limits).
- True live passengers-boarded (no free API exposes it).
- Real historical fare averages day-1 (needs 2–4 weeks of collected quotes; estimator is labeled modeled).
- Booking/affiliate checkout, login/alerts, playback history, dark mode, native apps.
- Live railways outside NTES-covered networks; live AIS beyond volunteer/keyless coverage; metro-live cities without open GTFS-RT (adapters park until a feed or key exists).

## Success metrics
- Map renders ≤3s on broadband, pans at 30fps+ with 500 markers.
- Detail panel opens ≤500ms after click (cached snapshot).
- Backend OpenSky/adsb.lol quota never exceeds free tier in 24h soak.
- Zero secrets in repo; `npm test` green.

## Open questions (resolved unless noted)
- Passenger: show capacity + band with disclaimer — RESOLVED yes.
- Scope: global best-effort, viewport-dense — RESOLVED.
- Booking → fare-estimate pivot — RESOLVED.
- Node+`ws` — RESOLVED.
- Remaining: Render vs Fly free host; Neon vs SQLite start (default: SQLite file, see ARCHITECTURE.md).
