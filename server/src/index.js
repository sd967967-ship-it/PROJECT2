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
const satellite = require("satellite.js");
const { DOMAINS, DOMAIN_META, assertDomain, deriveSrc, createRegistry } = require("./tracking/source");

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
  const solarMovers = solar.getSolarBodies(now);
  return { t: now.getTime(), src: tleStore.src(), movers: [...satMovers, ...solarMovers] };
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
    res.json({ t: s.t, src: s.src, count: s.movers.length, movers: s.movers });
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
    const bodies = solar.getSolarBodies(new Date());
    res.json({ t: Date.now(), src: "solar", count: bodies.length, bodies });
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
  return { app, server, wss, poller, seaPoller, streetsPoller, tleStore, domains };
}
if (require.main === module) start();
module.exports = { build, start, enrich, tracks, poller, isoFor };
