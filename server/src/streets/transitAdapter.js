// Streets Adapter: generic transit rows -> VehicleState -> movers, plus static
// stops. Live path is config-only (TRANSIT_URL); unset -> demo fallback.
// GTFS-RT protobuf cities stay parked per docs/PRD.md out-of-scope.
const DEMO = require("../../data/demo-transit.json");
const STOPS = require("../../data/stops.json");
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function str(v) { const s = String(v ?? "").trim(); return s || null; }
function normalizeVehicles(rows) {
  const list = Array.isArray(rows) ? rows : ((rows && (rows.vehicles || rows.data || rows.results)) || []);
  const out = [];
  for (const r of [].concat(list)) {
    if (!r || typeof r !== "object") continue;
    const lat = num(r.lat ?? r.latitude);
    const lon = num(r.lon ?? r.lng ?? r.longitude);
    const id = str(r.id ?? r.vehicleId ?? r.code);
    if (lat == null || lon == null || !id) continue;
    out.push({
      id,
      route: str(r.route ?? r.line ?? r.trip),
      system: str(r.system) || null,
      lat, lon,
      kmh: num(r.kmh ?? r.speed ?? r.velocity) ?? 0,
      hdg: num(r.hdg ?? r.heading ?? r.bearing),
      status: str(r.status) || "running",
      next: str(r.next ?? r.nextStop ?? r.next_stop),
      seenMs: 0,
      src: "transit",
    });
  }
  return out;
}
function toMovers(vehicles, src) {
  return vehicles.map((v) => ({
    id: v.id, domain: "streets", kind: "vehicle",
    lat: v.lat, lon: v.lon, altM: 0,
    velKmh: Math.round(v.kmh || 0),
    hdg: v.hdg,
    label: v.route ? `${v.route} · ${v.id}` : v.id,
    meta: { route: v.route, system: v.system, status: v.status, next: v.next },
    src: src || v.src || "transit",
  }));
}
async function fetchLive({ fetchJson, url } = {}) {
  if (!url) throw Object.assign(new Error("FEED_OFFLINE"), { code: "FEED_OFFLINE" });
  const { body } = await fetchJson(url);
  return normalizeVehicles(body);
}
function demoVehicles() { return DEMO.map((d) => ({ ...d, seenMs: 0, src: "demo" })); }
module.exports = { normalizeVehicles, toMovers, fetchLive, demoVehicles, stops: STOPS };
