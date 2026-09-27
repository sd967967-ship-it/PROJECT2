// SkyTrack server: static frontend + snapshot/detail API + ws broadcast. Single origin.
const path = require("node:path");
const express = require("express");
const { WebSocketServer } = require("ws");
const { Poller } = require("./ingestion/poller");
const { fetchAll: fetchOpenSky } = require("./ingestion/openskyAdapter");
const { WORLD_GRID, fetchSweep } = require("./ingestion/adsbLolAdapter");
const { fuse } = require("./fusion/fuse");
const { haversineKm, arcPoints, nearestAirport } = require("./fusion/geo");
const { etaFor } = require("./fusion/eta");
const { getCapacity } = require("./capacity");
const { estimateFares } = require("./pricing");
const { airlineOf, getServices } = require("./services");
const { attach } = require("./broadcast");
const { RouteCache } = require("./routes");
const { fetchJson } = require("./ingestion/fetchJson");
const sea = require("./sea/aisAdapter");
const streets = require("./streets/transitAdapter");
const tle = require("./space/tle");
const solar = require("./space/solar");
const craft = require("./space/craft");
const satellite = require("satellite.js");
const { DOMAINS, DOMAIN_META, assertDomain, deriveSrc, createRegistry } = require("./tracking/source");
const quakes = require("./geo/quakes");
const events = require("./geo/events");
const wx = require("./geo/wx");
const spacewx = require("./geo/spacewx");
const status = require("./status");

const AIRPORTS = require("../data/airports.json");
const COUNTRIES = require("../data/countries.json");
const DEMO = require("../data/demo-flights.json");
const byIata = new Map(AIRPORTS.map((a) => [a.iata, a]));
const byIcao = new Map(AIRPORTS.map((a) => [a.icao, a]));
const routes = new RouteCache();

function isoFor(track, airline) {
  if (airline && airline.iso) return airline.iso;
  if (track.originCountry && COUNTRIES[track.originCountry]) return COUNTRIES[track.originCountry];
  return null;
}
function enrich(track) {
  const airline = airlineOf(track.callsign);
  const capacity = getCapacity(track.type);
  const services = getServices(track.callsign);
  const iso = isoFor(track, airline);
  let route = null, fares = null, eta = { remainH: null, etaUtc: null };
  const o = track.origin && byIata.get(track.origin);
  const d = track.dest && byIata.get(track.dest);
  if (o && d) {
    const distKm = Math.round(haversineKm([o.lat, o.lon], [d.lat, d.lon]));
    const remainKm = track.lat != null ? Math.round(haversineKm([track.lat, track.lon], [d.lat, d.lon])) : distKm;
    eta = etaFor(remainKm, track.velKmh);
    fares = estimateFares(distKm);
    route = { origin: o, dest: d, distKm, remainKm, arc: arcPoints([o.lat, o.lon], [d.lat, d.lon], 48) };
  }
  return { ...track, airline, capacity, services, iso, route, fares, eta };
}
function tracks() {
  const snap = poller.getSnapshot();
  let list = fuse(snap.states, { airports: AIRPORTS });
  let src = snap.src;
  if (!list.length) { // demo fallback keeps the site presentable when feeds are unreachable
    list = DEMO.map((d) => ({ ...d, onGround: false, originCountry: null, near: null }));
    src = "demo";
  }
  return { t: snap.t || Date.now(), src, tracks: list };
}
// Worldwide fallback registry: each cycle sweeps one rotating grid group and
// merges into hex-keyed memory (5min TTL), so coverage accumulates planet-wide.
const SWEEP_GROUPS = [];
for (let i = 0; i < WORLD_GRID.length; i += 8) SWEEP_GROUPS.push(WORLD_GRID.slice(i, i + 8));
let sweepIdx = 0;
let sweepCooldownUntil = 0;
const registry = new Map();
const REG_TTL_MS = 5 * 60e3;
const poller = new Poller({
  fetchPrimary: () => fetchOpenSky(),
  fetchFallback: async () => {
    const now = Date.now();
    if (now < sweepCooldownUntil && registry.size) return [...registry.values()]; // cooling down: serve memory
    const group = SWEEP_GROUPS[sweepIdx++ % SWEEP_GROUPS.length];
    let rows = [];
    try {
      rows = await fetchSweep(group);
    } catch (e) {
      if (e && e.code === "FEED_SWEEP_THROTTLED") {
        rows = e.partial || [];
        sweepCooldownUntil = now + 90000; // back off the throttled feed, keep serving registry
      } else throw e;
    }
    for (const r of rows) registry.set(r.hex, { ...r, seenAt: now });
    for (const [k, v] of registry) if (now - v.seenAt > REG_TTL_MS) registry.delete(k);
    while (registry.size > 15000) registry.delete(registry.keys().next().value);
    if (!registry.size) throw Object.assign(new Error("FEED_OFFLINE"), { code: "FEED_OFFLINE" });
    return [...registry.values()];
  },
  intervalMs: Number(process.env.POLL_MS || 30000),
});
// One poller per domain (see HLD.md): sea/streets reuse Poller with demo
// fallback; space refreshes TLE hourly and propagates per request.
const seaPoller = new Poller({
  fetchPrimary: () => sea.fetchLive({ fetchJson, url: process.env.AIS_URL, apiKey: process.env.AIS_KEY }),
  fetchFallback: async () => sea.demoVessels(),
  intervalMs: Number(process.env.SEA_POLL_MS || 60000),
});
const streetsPoller = new Poller({
  fetchPrimary: () => streets.fetchLive({ fetchJson, url: process.env.TRANSIT_URL }),
  fetchFallback: async () => streets.demoVehicles(),
  intervalMs: Number(process.env.STREET_POLL_MS || 30000),
});
const tleStore = tle.createTleStore();
// Hazard + space-weather pollers (keyless public feeds; empty cache reads as
// unavailable in /api/layers, never as live).
const quakePoller = new Poller({
  fetchPrimary: () => quakes.fetchQuakes({ fetchJson }),
  intervalMs: 300000,
});
const eventPoller = new Poller({
  fetchPrimary: () => events.fetchEvents({ fetchJson }),
  intervalMs: 1800000,
});
const swpcPoller = new Poller({
  fetchPrimary: () => spacewx.fetchKp({ fetchJson }),
  intervalMs: 900000,
});
const firePoller = new Poller({
  fetchPrimary: () => spacewx.fetchFireballs({ fetchJson }),
  intervalMs: 3600000,
});
let lastWx = null; // {t} — weather is queried on demand, never polled
function skyToMover(t) {
  return {
    id: t.hex, domain: "sky", kind: "flight",
    lat: t.lat, lon: t.lon, altM: t.altM, velKmh: t.velKmh, hdg: t.hdg,
    label: t.callsign || t.hex,
    meta: { origin: t.origin, dest: t.dest, type: t.type, near: t.near && t.near.iata },
    src: t.src,
  };
}
function seaSnapshot() {
  const s = seaPoller.getSnapshot();
  const states = (s.states && s.states.length) ? s.states : sea.demoVessels();
  const src = (s.states && s.states.length) ? deriveSrc(s.src, s.states) : "demo";
  return { t: s.t || Date.now(), src, movers: sea.toMovers(states, src) };
}
function streetsSnapshot() {
  const s = streetsPoller.getSnapshot();
  const states = (s.states && s.states.length) ? s.states : streets.demoVehicles();
  const src = (s.states && s.states.length) ? deriveSrc(s.src, s.states) : "demo";
  return { t: s.t || Date.now(), src, movers: streets.toMovers(states, src) };
}
function spaceSnapshot() {
  const now = new Date();
  const satMovers = tle.propagateToMovers(tleStore.sets(), now, satellite, tleStore.src());
  const bodies = solar.getSolarBodies(now);
  const byId = {};
  for (const b of bodies) byId[b.id] = b;
  const craftMovers = craft.toMovers(craft.CRAFT, byId);
  return { t: now.getTime(), src: tleStore.src(), movers: [...satMovers, ...bodies, ...craftMovers], earthHelio: solar.earthHelio(now) };
}
const domains = createRegistry({
  sky: { getSnapshot: () => { const s = tracks(); return { t: s.t, src: s.src, movers: s.tracks.map(skyToMover) }; } },
  sea: { getSnapshot: seaSnapshot },
  streets: { getSnapshot: streetsSnapshot },
  space: { getSnapshot: spaceSnapshot },
});
function seaDetail(id) {
  const m = seaSnapshot().movers.find((x) => x.id === String(id));
  if (!m) return null;
  const port = nearestAirport(m.lat, m.lon, sea.ports.map((p) => ({ ...p, iata: p.code })));
  return { ...m, near: port && { iata: port.code || port.iata, city: port.city, distKm: port.distKm } };
}
function streetsDetail(id) {
  const m = streetsSnapshot().movers.find((x) => x.id === String(id));
  if (!m) return null;
  const stop = nearestAirport(m.lat, m.lon, streets.stops.map((p) => ({ ...p, iata: p.id })));
  return { ...m, near: stop && { iata: stop.id || stop.iata, city: stop.city, distKm: stop.distKm } };
}
function spaceDetail(id) {
  return spaceSnapshot().movers.find((x) => x.id === String(id)) || null;
}
function build() {
  const app = express();
  app.disable("x-powered-by");
  // Baseline hardening (no new deps): no sniffing, no framing by others,
  // tight referrer, locked-down plugins. script-src stays permissive for the
  // Cesium CDN bundle (eval + WASM) and the inline boot script by design —
  // host-allowlisted so injected markup cannot pull scripts from elsewhere
  // (XSS defense itself lives in esc(); see shared.js). Documented in ARCHITECTURE.md.
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' https://unpkg.com https://cdn.jsdelivr.net 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'; style-src 'self' https://fonts.googleapis.com https://unpkg.com https://cdn.jsdelivr.net 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://unpkg.com https://cdn.jsdelivr.net ws: wss:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    next();
  });
  app.get("/api/health", (req, res) => res.json({ ok: true, src: poller.getSnapshot().src, t: poller.getSnapshot().t }));
  app.get("/favicon.ico", (req, res) => res.sendFile(path.join(__dirname, "..", "..", "public", "logo.svg")));
  app.get("/api/airports", (req, res) => {
    // Static hubs + live nearby counts derived from the current snapshot (no extra feed cost).
    const s = tracks();
    const counts = {};
    for (const t of s.tracks) if (t.near) counts[t.near.iata] = (counts[t.near.iata] || 0) + 1;
    res.json({ t: s.t, src: s.src, airports: AIRPORTS.map((a) => ({ ...a, nearby: counts[a.iata] || 0 })) });
  });
  app.get("/api/snapshot", (req, res) => {
    const s = tracks();
    res.json({ t: s.t, src: s.src, count: s.tracks.length, tracks: s.tracks });
  });
  app.get("/api/flights/:hex", async (req, res) => {
    const s = tracks();
    const t = s.tracks.find((x) => x.hex === String(req.params.hex).toLowerCase());
    if (!t) return res.status(404).json({ error: "stale, retry" });
    const flight = enrich(t);
    // Click-to-resolve: destination + ETA + company via cached OpenSky history.
    // Only when the primary feed is healthy, so clicks never burn throttled quota.
    if (!flight.route && poller.healthy() && flight.src !== "demo") {
      try {
        const r = await routes.resolve(flight.hex);
        const d = r && r.destIcao && byIcao.get(r.destIcao.toUpperCase());
        if (d) {
          const o = (r.originIcao && byIcao.get(r.originIcao.toUpperCase())) || null;
          const distKm = o ? Math.round(haversineKm([o.lat, o.lon], [d.lat, d.lon])) : null;
          const remainKm = Math.round(haversineKm([flight.lat, flight.lon], [d.lat, d.lon]));
          flight.origin = o ? o.iata : (r.originIcao || null);
          flight.dest = d.iata;
          flight.eta = etaFor(remainKm, flight.velKmh);
          flight.fares = distKm != null ? estimateFares(distKm) : null;
          flight.route = {
            origin: o || { iata: r.originIcao, lat: flight.lat, lon: flight.lon },
            dest: d, distKm, remainKm,
            arc: o ? arcPoints([o.lat, o.lon], [d.lat, d.lon], 48) : null,
          };
        }
      } catch { /* position-only on any failure */ }
    }
    res.json({ t: s.t, src: s.src, flight });
  });
  app.get("/api/domains", (req, res) => res.json({ domains: domains.domains() }));
  app.get("/api/:domain/snapshot", (req, res) => {
    let d;
    try { d = assertDomain(req.params.domain); }
    catch { return res.status(404).json({ error: "unknown domain" }); }
    if (d === "sky") {
      const s = tracks();
      return res.json({ t: s.t, src: s.src, count: s.tracks.length, tracks: s.tracks });
    }
    const s = domains.getSnapshot(d);
    const out = { t: s.t, src: s.src, count: s.movers.length, movers: s.movers };
    if (s.earthHelio) out.earthHelio = s.earthHelio;
    res.json(out);
  });
  app.get("/api/sea/vessels/:id", (req, res) => {
    const s = seaSnapshot();
    const v = seaDetail(req.params.id);
    if (!v) return res.status(404).json({ error: "stale, retry" });
    res.json({ t: s.t, src: s.src, vessel: v });
  });
  app.get("/api/streets/vehicles/:id", (req, res) => {
    const s = streetsSnapshot();
    const v = streetsDetail(req.params.id);
    if (!v) return res.status(404).json({ error: "stale, retry" });
    res.json({ t: s.t, src: s.src, vehicle: v });
  });
  app.get("/api/streets/stops", (req, res) => {
    res.json({ t: Date.now(), src: "static", stops: streets.stops });
  });
  app.get("/api/space/objects/:id", (req, res) => {
    const s = spaceSnapshot();
    const o = spaceDetail(req.params.id);
    if (!o) return res.status(404).json({ error: "stale, retry" });
    res.json({ t: s.t, src: s.src, object: o });
  });
  app.get("/api/space/solar", (req, res) => {
    let at = new Date();
    if (req.query.date != null) {
      const ms = Date.parse(req.query.date);
      if (!Number.isFinite(ms) || ms < Date.parse("1900-01-01") || ms > Date.parse("2100-01-01")) {
        return res.status(400).json({ error: "date must be ISO 1900-2100" });
      }
      at = new Date(ms);
    }
    const bodies = solar.getSolarBodies(at);
    res.json({ t: Date.now(), src: "solar", date: at.toISOString(), count: bodies.length, bodies, earthHelio: solar.earthHelio(at) });
  });
  app.get("/api/space/craft", (req, res) => {
    res.json({ t: Date.now(), src: "static", count: craft.CRAFT.length, craft: craft.CRAFT });
  });
  const layerDefs = [
    { id: "flights", category: "Aviation", label: "Flights", description: "Live aircraft (ADS-B)", source: "OpenSky + adsb.lol", credit: "OpenSky + adsb.lol (ODbL)", cadenceMs: Number(process.env.POLL_MS || 30000), coverage: "best-effort global", onDefault: true, kind: "snapshot", get: () => { const s = tracks(); return { src: s.src, t: s.t, states: s.tracks }; } },
    { id: "vessels", category: "Maritime", label: "Vessels", description: "Ship positions", source: "keyless AIS when configured", credit: "provider at AIS_URL", cadenceMs: Number(process.env.SEA_POLL_MS || 60000), coverage: "per feed", onDefault: false, kind: "snapshot", parked: !process.env.AIS_URL, parkedNote: "needs AIS_URL — showing sample positions", get: () => { const s = seaSnapshot(); return { src: s.src, t: s.t, states: s.movers }; } },
    { id: "vehicles", category: "Ground transit", label: "Vehicles", description: "Transit vehicle positions", source: "city JSON feed when configured", credit: "agency at TRANSIT_URL", cadenceMs: Number(process.env.STREET_POLL_MS || 30000), coverage: "per city", onDefault: false, kind: "snapshot", parked: !process.env.TRANSIT_URL, parkedNote: "needs TRANSIT_URL — showing sample vehicles", get: () => { const s = streetsSnapshot(); return { src: s.src, t: s.t, states: s.movers }; } },
    { id: "satellites", category: "Space", label: "Satellites", description: "TLE-propagated orbiters (predictions, not precise tracking)", source: "CelesTrak", credit: "CelesTrak (courtesy)", cadenceMs: 3600000, coverage: "catalogued objects", onDefault: false, kind: "snapshot", get: () => { const s = spaceSnapshot(); return { src: s.src, t: s.t, states: s.movers.filter((m) => m.kind === "satellite") }; } },
    { id: "airports", category: "Infrastructure", label: "Airports", description: "Major hub reference points", source: "bundled OpenFlights subset", credit: "OpenFlights", coverage: "30 world hubs", onDefault: true, kind: "static" },
    { id: "ports", category: "Infrastructure", label: "Ports", description: "Major world ports", source: "bundled reference set", coverage: "100+ ports", onDefault: false, kind: "static" },
    { id: "stops", category: "Infrastructure", label: "Transit stops", description: "Worldwide rail/bus hubs", source: "bundled reference set", coverage: "70 hubs", onDefault: false, kind: "static" },
    { id: "quakes", category: "Natural hazards", label: "Earthquakes", description: "USGS M4.5+ (preliminary vs reviewed marked)", source: "USGS FDSNWS", credit: "USGS (public domain)", cadenceMs: 300000, coverage: "global", onDefault: true, kind: "snapshot", get: () => { const s = quakePoller.getSnapshot(); return { src: s.src, t: s.t, states: s.states }; } },
    { id: "events", category: "Natural hazards", label: "Natural events", description: "NASA EONET: fires, storms, volcanoes, floods", source: "NASA EONET", credit: "NASA (public domain)", cadenceMs: 1800000, coverage: "global", onDefault: false, kind: "snapshot", get: () => { const s = eventPoller.getSnapshot(); return { src: s.src, t: s.t, states: s.states }; } },
    { id: "terminator", category: "Atmosphere", label: "Day/night line", description: "Terminator from the subsolar point", source: "computed from solar ephemeris", coverage: "global", onDefault: true, kind: "computed" },
    { id: "weather", category: "Atmosphere", label: "Weather", description: "Point conditions + AQI on demand", source: "Open-Meteo", credit: "Open-Meteo (attribution)", cadenceMs: 600000, coverage: "global, point queries", onDefault: false, kind: "ondemand", last: () => lastWx, parkedNote: "query on demand" },
    { id: "aurora", category: "Space weather", label: "Aurora (Kp)", description: "Planetary K-index readout", source: "NOAA SWPC", credit: "SWPC (public domain)", cadenceMs: 900000, coverage: "global index", onDefault: false, kind: "snapshot", get: () => { const s = swpcPoller.getSnapshot(); return { src: s.src, t: s.t, states: s.states }; } },
    { id: "fireballs", category: "Space", label: "Fireballs", description: "Reported meteor events (CNEOS)", source: "NASA CNEOS", credit: "NASA/JPL (public domain)", cadenceMs: 3600000, coverage: "reported events", onDefault: false, kind: "snapshot", get: () => { const s = firePoller.getSnapshot(); return { src: s.src, t: s.t, states: s.states }; } },
  ];
  app.get("/api/layers", (req, res) => {
    res.json({ t: Date.now(), layers: status.buildLayers(layerDefs) });
  });
  app.get("/api/hazards/quakes", (req, res) => {
    const minMag = req.query.minMag == null ? 4.5 : Number(req.query.minMag);
    const limit = req.query.limit == null ? 100 : Number(req.query.limit);
    if (!Number.isFinite(minMag) || minMag < 0 || minMag > 10 || !Number.isFinite(limit) || limit < 1 || limit > 500) {
      return res.status(400).json({ error: "minMag 0-10, limit 1-500" });
    }
    const s = quakePoller.getSnapshot();
    const rows = (s.states || []).filter((q) => (q.mag ?? 0) >= minMag).slice(0, limit);
    res.json({ t: s.t || Date.now(), src: s.src === "none" ? "unavailable" : s.src, count: rows.length, quakes: rows });
  });
  app.get("/api/hazards/events", (req, res) => {
    const s = eventPoller.getSnapshot();
    res.json({ t: s.t || Date.now(), src: s.src === "none" ? "unavailable" : s.src, count: (s.states || []).length, events: s.states || [] });
  });
  app.get("/api/weather", async (req, res) => {
    let p;
    try { p = wx.validatePoint(req.query.lat, req.query.lon); }
    catch (e) { return res.status(e.status || 400).json({ error: "lat -90..90, lon -180..180 required" }); }
    const units = req.query.units === "imperial" ? "imperial" : "metric";
    try {
      const data = await wx.fetchWx({ fetchJson, lat: p.lat, lon: p.lon, units });
      lastWx = { t: Date.now() };
      res.json({ t: Date.now(), ...data });
    } catch (e) {
      res.status(502).json({ error: "weather provider unreachable" });
    }
  });
  app.get("/api/space/weather", (req, res) => {
    const k = swpcPoller.getSnapshot();
    const f = firePoller.getSnapshot();
    res.json({
      t: Date.now(),
      kp: (k.states && k.states[0]) || null,
      kpSrc: k.src === "none" ? "unavailable" : k.src,
      fireballs: f.states || [],
      fireballCount: (f.states || []).length,
      fireballSrc: f.src === "none" ? "unavailable" : f.src,
    });
  });
  app.get("/api/sea/ports", (req, res) => {
    res.json({ t: Date.now(), src: "static", count: sea.ports.length, ports: sea.ports });
  });
  app.use(express.static(path.join(__dirname, "..", "..", "public")));
  return app;
}
function start(port = Number(process.env.PORT || 3000)) {
  const app = build();
  const server = app.listen(port, () => console.log(`SkyTrack on http://localhost:${server.address().port} src=${poller.getSnapshot().src}`));
  const wss = new WebSocketServer({ server });
  // Broadcast per-domain snapshots over the same ws contract (see TECHFLOW.md).
  const provider = {
    getSnapshot: () => { const s = tracks(); return { t: s.t, src: s.src, states: s.tracks }; },
    getSnapshotFor: (domain) => {
      if (domain === "sea") { const s = seaSnapshot(); return { t: s.t, src: s.src, states: s.movers }; }
      if (domain === "streets") { const s = streetsSnapshot(); return { t: s.t, src: s.src, states: s.movers }; }
      if (domain === "space") { const s = spaceSnapshot(); return { t: s.t, src: s.src, states: s.movers }; }
      const s = tracks(); return { t: s.t, src: s.src, states: s.tracks };
    },
  };
  attach(wss, provider);
  poller.start();
  seaPoller.start();
  streetsPoller.start();
  tleStore.start();
  quakePoller.start();
  eventPoller.start();
  swpcPoller.start();
  firePoller.start();
  return { app, server, wss, poller, seaPoller, streetsPoller, tleStore, quakePoller, eventPoller, swpcPoller, firePoller, domains };
}
if (require.main === module) {
  if (process.env.OPENSKY_USER && !process.env.OPENSKY_PASS) {
    console.warn("OPENSKY_USER set without OPENSKY_PASS — anonymous quota applies");
  }
  start();
}
module.exports = { build, start, enrich, tracks, poller, isoFor };
