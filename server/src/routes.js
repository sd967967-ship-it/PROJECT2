// Route Module: icao24 -> {originIcao, destIcao} via OpenSky flight history.
// Cached (positive 6h, negative 15min) so clicks never hammer quota.
// Fetcher accepted, never created (test seam).
const { fetchJson } = require("./ingestion/fetchJson");
function pickRoute(flights) {
  if (!Array.isArray(flights) || !flights.length) return null;
  const done = flights.filter((f) => f && f.estArrivalAirport).sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
  const f = done[0] || flights.slice().sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))[0];
  if (!f) return null;
  return {
    originIcao: f.estDepartureAirport || null,
    destIcao: f.estArrivalAirport || null,
    callsign: (f.callsign || "").trim() || null,
  };
}
async function defaultFetch(hex) {
  const end = Math.floor(Date.now() / 1000);
  const begin = end - 6 * 3600;
  const { body } = await fetchJson(
    `https://opensky-network.org/api/flights/aircraft?icao24=${encodeURIComponent(hex)}&begin=${begin}&end=${end}`
  );
  return pickRoute(body);
}
class RouteCache {
  constructor({ fetchRoute = defaultFetch, posTtlMs = 6 * 3600e3, negTtlMs = 15 * 60e3 } = {}) {
    this.fetchRoute = fetchRoute;
    this.posTtlMs = posTtlMs;
    this.negTtlMs = negTtlMs;
    this.map = new Map(); // hex -> {t, route|null}
  }
  async resolve(hex) {
    const key = String(hex).toLowerCase();
    const hit = this.map.get(key);
    const now = Date.now();
    if (hit) {
      const ttl = hit.route && hit.route.destIcao ? this.posTtlMs : this.negTtlMs;
      if (now - hit.t < ttl) return hit.route;
    }
    let route = null;
    try { route = await this.fetchRoute(key); } catch { route = null; }
    if (this.map.size > 2000) this.map.clear();
    this.map.set(key, { t: now, route });
    return route;
  }
}
module.exports = { RouteCache, pickRoute, defaultFetch };
