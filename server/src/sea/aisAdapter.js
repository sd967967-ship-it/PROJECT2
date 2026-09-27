// Sea Adapter: generic AIS rows -> VesselState -> movers. Live path is
// config-only (AIS_URL/AIS_KEY); unset -> demo fallback. No guessed endpoints.
const DEMO = require("../../data/demo-vessels.json");
const PORTS = require("../../data/ports.json");
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function str(v) { const s = String(v ?? "").trim(); return s || null; }
function normalizeVessels(rows) {
  const list = Array.isArray(rows) ? rows : ((rows && (rows.vessels || rows.data || rows.results)) || []);
  const out = [];
  for (const r of [].concat(list)) {
    if (!r || typeof r !== "object") continue;
    const lat = num(r.lat ?? r.latitude);
    const lon = num(r.lon ?? r.lng ?? r.longitude);
    const mmsi = str(r.mmsi ?? r.id);
    if (lat == null || lon == null || !mmsi) continue;
    const knots = num(r.knots ?? r.sog ?? r.speed);
    out.push({
      mmsi,
      name: str(r.name ?? r.shipname),
      callsign: str(r.callsign),
      lat, lon,
      knots: knots ?? 0,
      hdg: num(r.hdg ?? r.cog ?? r.heading),
      type: str(r.type ?? r.shiptype),
      flag: str(r.flag),
      dest: str(r.dest ?? r.destination),
      draughtM: num(r.draught ?? r.draughtM),
      seenMs: 0,
      src: "ais",
    });
  }
  return out;
}
function toMovers(vessels, src) {
  return vessels.map((v) => ({
    id: v.mmsi, domain: "sea", kind: "vessel",
    lat: v.lat, lon: v.lon, altM: 0,
    velKmh: Math.round((v.knots || 0) * 1.852),
    hdg: v.hdg,
    label: v.name || v.callsign || v.mmsi,
    meta: { type: v.type, flag: v.flag, dest: v.dest, draughtM: v.draughtM },
    src: src || v.src || "ais",
  }));
}
async function fetchLive({ fetchJson, url, apiKey } = {}) {
  if (!url) throw Object.assign(new Error("FEED_OFFLINE"), { code: "FEED_OFFLINE" });
  const headers = apiKey ? { "x-ais-key": apiKey } : {};
  const { body } = await fetchJson(url, { headers });
  return normalizeVessels(body);
}
function demoVessels() { return DEMO.map((d) => ({ ...d, seenMs: 0, src: "demo" })); }
module.exports = { normalizeVessels, toMovers, fetchLive, demoVessels, ports: PORTS };
