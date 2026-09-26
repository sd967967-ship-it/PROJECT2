# SkyTrack Multimodal + Space Plan (2026-09-27)

## Goal
One app, one globe/dossier/search/ticker UI, five live domains (sky, sea, streets, metros/buses, space) plus a solar-system view — all on free tiers.

## Feasibility verdict (evidence-graded, 2026-09-27)
| Domain | Free worldwide-live? | Basis |
|---|---|---|
| Space satellites | YES | CelesTrak TLE probed live: no key, fresh 2026 epochs |
| Solar system + major moons | YES | Pure math (Kepler) or `astronomy.engine` (MIT); no feed needed |
| Transit stops worldwide (static) | YES | Open static GTFS data (e.g. Transitland Atlas, open GitHub data) |
| Ships live (AIS) | NO keyless | AISHub/aisstream need feeder or signup keys; probed alternatives 403/404 earlier. Parked behind key slot. |
| Metros/buses live vehicles | PARTIAL | Only where a city publishes open GTFS-RT; no single global keyless feed. Adapter per city, lights up with zero code change once a feed URL is added. |
| Railways live | NO | No open global realtime rail feed (e.g. NTES needs approval). Schedules-only until a feed exists. |

Keys: the agent cannot create user accounts (email verification + ToS). Any adapter marked "needs key" stays parked until the user pastes a free key into `.env`; no code changes needed at activation.

## Architecture (deep modules, one new seam)
- New Module `TrackingSource`, Interface `getSnapshot(domain, bbox?) -> movers[]` where `movers[] = {id, lat, lon, altM, velKmh, hdg, label, meta}`.
- Adapters: `adsb` (exists), `tle` (new: CelesTrak fetch + `satellite.js` propagation, MIT dep — record in ARCHITECTURE.md before install), `ais` (skeleton, key slot), `gtfs-rt` (skeleton per city, key/URL slot), `gtfs-static` (stops loader), `solar` (math-only, zero network).
- Reuse (leverage): globe, dossier, search, ticker, trails, follow, clustering stay domain-agnostic; mode switcher (Sky/Sea/Streets/Space) swaps the Adapter only.
- Space scene: separate Three.js/Cesium scene — Sun + 8 planets (real periods) + major moons (Moon, Galilean 4, Titan) + TLE belt (cap counts: stations + visual + sample). Click satellite → name/alt/vel/operator dossier. Procedural textures first; NASA public-domain textures optional later.

## Phases
1. **Space + Solar (no keys):** TLE fetch/cache (`server/src/space/`), propagation, mode switcher, solar scene, satellite dossier, moon orbits. Acceptance: ISS + 500 same sats live, planets + 6 moons render, click works.
2. **Static worldwide stops:** GTFS static loader → bus/metro/railway station dots worldwide on Streets mode. Acceptance: stops visible per city searched.
3. **Parked adapters:** `ais` + `gtfs-rt` skeletons with `.env.example` slots (`AIS_KEY`, `GTFS_RT_URL_<CITY>`), docs in ARCHITECTURE.md. Acceptance: activating = config-only, verified by contract tests with fixtures.
4. **Polish (optional):** banner-design launch banner, slides deck for new modes.

## Test hooks (existing system)
- `server/test/space.test.js`: TLE parse, propagation sanity (ISS alt 400–440km, period ~92.9min), cache TTL.
- Repo static tests: mode-switch IDs, solar scene refs.
- QA cycles reuse `tests/run.js` + headless screenshots per mode.

## Docs updates (same turn as code, per AGENTS.md Rule 2)
PRD scope table, HLD diagram (+Space box), LLD (TrackingSource + space modules), ARCHITECTURE (satellite.js, key slots), PROGRESS entries.
