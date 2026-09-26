// SkyTrack server: static frontend + snapshot/detail API + ws broadcast. Single origin.
const path = require("node:path");
const express = require("express");
const { WebSocketServer } = require("ws");
const { Poller } = require("./ingestion/poller");
const { fetchAll: fetchOpenSky } = require("./ingestion/openskyAdapter");
const { fetchPoint, HUBS } = require("./ingestion/adsbLolAdapter");
const { fuse } = require("./fusion/fuse");
const { haversineKm, arcPoints } = require("./fusion/geo");
const { etaFor } = require("./fusion/eta");
const { getCapacity } = require("./capacity");
const { estimateFares } = require("./pricing");
const { airlineOf, getServices } = require("./services");
const { attach } = require("./broadcast");

const AIRPORTS = require("../data/airports.json");
const COUNTRIES = require("../data/countries.json");
const DEMO = require("../data/demo-flights.json");
const byIata = new Map(AIRPORTS.map((a) => [a.iata, a]));

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
const poller = new Poller({
  fetchPrimary: () => fetchOpenSky(),
  fetchFallback: async () => {
    // Merge all hub regions so fallback stays dense instead of swinging hub to hub.
    const out = new Map();
    for (const h of HUBS) {
      try {
        const rows = await fetchPoint(h[0], h[1], 250);
        for (const r of rows) if (!out.has(r.hex)) out.set(r.hex, r);
      } catch { /* one hub failing must not sink the rest */ }
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!out.size) throw Object.assign(new Error("FEED_OFFLINE"), { code: "FEED_OFFLINE" });
    return [...out.values()];
  },
  intervalMs: Number(process.env.POLL_MS || 10000),
});
function build() {
  const app = express();
  app.disable("x-powered-by");
  app.get("/api/health", (req, res) => res.json({ ok: true, src: poller.getSnapshot().src, t: poller.getSnapshot().t }));
  app.get("/api/snapshot", (req, res) => {
    const s = tracks();
    res.json({ t: s.t, src: s.src, count: s.tracks.length, tracks: s.tracks });
  });
  app.get("/api/flights/:hex", (req, res) => {
    const s = tracks();
    const t = s.tracks.find((x) => x.hex === String(req.params.hex).toLowerCase());
    if (!t) return res.status(404).json({ error: "stale, retry" });
    res.json({ t: s.t, src: s.src, flight: enrich(t) });
  });
  app.use(express.static(path.join(__dirname, "..", "..", "public")));
  return app;
}
function start(port = Number(process.env.PORT || 3000)) {
  const app = build();
  const server = app.listen(port, () => console.log(`SkyTrack on http://localhost:${server.address().port} src=${poller.getSnapshot().src}`));
  const wss = new WebSocketServer({ server });
  // Broadcast fused tracks: wrap poller snapshot through the same track pipeline.
  const fused = { getSnapshot: () => { const s = tracks(); return { t: s.t, src: s.src, states: s.tracks }; } };
  attach(wss, fused);
  poller.start();
  return { app, server, wss, poller };
}
if (require.main === module) start();
module.exports = { build, start, enrich, tracks, poller, isoFor };
