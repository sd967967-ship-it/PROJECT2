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
4. Stack: Node + Express + `ws` backend; Cesium 3D globe + Esri satellite frontend (built 2026-09-27, replaced Leaflet plan for designer-3D brief).

| ID | As a... | I want to... | So that... | Status |
|----|---------|--------------|------------|--------|
| P1 | viewer | see live aircraft on a world map with search by callsign/route/airport | I can find flights fast | done 2026-09-27 |
| P2 | viewer | click a plane → speed, ETA, flying hours, path, capacity, services, fare avgs | I get full context in one panel | done (ETA/fares only when route known; else position-only) |
| P3 | viewer | filter to my viewport with smooth 500+ markers | map stays fast globally | done (800 cap + requestRenderMode) |
| P4 | viewer | see airport departures/arrivals derived from live tracks | I can browse hubs | partial (nearest-hub per track; board pending) |
| P5 | builder | run everything on free tiers with no API keys | cost stays zero | done |

## Out of scope (explicitly not building yet)
- Guaranteed every-flight-in-world coverage (needs paid feed/feeders; see HLD.md limits).
- True live passengers-boarded (no free API exposes it).
- Real historical fare averages day-1 (needs 2–4 weeks of collected quotes; estimator is labeled modeled).
- Booking/affiliate checkout, login/alerts, playback history, dark mode, native apps.

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
