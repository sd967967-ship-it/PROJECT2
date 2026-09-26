// adsb.lol Adapter (gap-fill): maps /v2/point responses to AircraftState.
const { fetchJson } = require("./fetchJson");
function mapAc(body) {
  if (!body || !Array.isArray(body.ac)) throw Object.assign(new Error("FEED_INVALID"), { code: "FEED_INVALID" });
  const out = [];
  for (const a of body.ac) {
    if (typeof a.lat !== "number" || typeof a.lon !== "number") continue;
    out.push({
      hex: String(a.hex || "").toLowerCase(),
      callsign: String(a.flight || "").trim() || null,
      originCountry: null,
      lat: a.lat, lon: a.lon,
      altM: typeof a.alt_baro === "number" ? a.alt_baro * 0.3048 : null,
      velMs: typeof a.gs === "number" ? a.gs * 0.514444 : 0,
      hdg: typeof a.track === "number" ? a.track : null,
      vsMs: typeof a.baro_rate === "number" ? a.baro_rate * 0.00508 : null,
      squawk: a.squawk || null,
      onGround: false,
      seenMs: typeof a.seen === "number" ? a.seen * 1000 : 0,
      lastContactSec: null,
      type: a.t || null,
      src: "adsb.lol",
    });
  }
  return out;
}
// Hub rotation points keep fallback inside free fair-use when primary fails.
// Eight hubs approximate worldwide coverage (APAC, Europe, N/S America, ME, Oceania, Africa edge).
const HUBS = [[28.57, 77.1], [51.47, -0.45], [40.64, -73.78], [1.36, 103.99], [25.25, 55.36], [-33.95, 151.18], [-23.44, -46.47], [33.94, -118.41]];
// WORLD_GRID sweeps the planet: each cycle queries one rotating group, and the
// caller merges results into a persistent registry, so coverage accumulates to
// near-worldwide over ~2 minutes instead of one region at a time.
const WORLD_GRID = [
  [28.57, 77.1], [19.09, 72.87], [13.2, 77.71],
  [25.25, 55.36], [25.27, 51.61], [24.63, 46.72], [41.26, 28.74], [30.12, 31.41], [32.0, 34.88],
  [51.47, -0.45], [50.03, 8.56], [49.01, 2.55], [52.31, 4.76], [40.47, -3.57], [41.8, 12.25], [47.46, 8.55], [37.94, 23.94],
  [8.98, 38.8], [-26.14, 28.25], [3.38, 3.45], [-1.32, 36.93],
  [40.64, -73.78], [41.97, -87.91], [32.9, -97.04], [33.94, -118.41], [37.62, -122.38], [43.68, -79.63], [19.44, -99.07], [25.79, -80.29],
  [-23.44, -46.47], [-34.83, -58.54], [4.7, -74.14],
  [1.36, 103.99], [22.31, 113.91], [35.77, 140.39], [37.46, 126.44], [40.08, 116.58], [31.14, 121.81], [13.69, 100.75], [3.13, 101.55], [23.84, 90.4],
  [-33.95, 151.18], [-37.01, 174.79],
];
async function fetchPoint(lat, lon, radiusNm = 250) {
  const { body } = await fetchJson(`https://api.adsb.lol/v2/point/${lat}/${lon}/${radiusNm}`);
  return mapAc(body);
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function fetchSweep(points, { gapMs = 1200, fetchFn = fetchPoint } = {}) {
  const out = [];
  for (const [lat, lon] of points) {
    try {
      out.push(...await fetchFn(lat, lon, 250));
    } catch (e) {
      if (e && e.code === "FEED_RATE_LIMITED") {
        const err = new Error("FEED_SWEEP_THROTTLED");
        err.code = "FEED_SWEEP_THROTTLED"; err.partial = out;
        throw err; // stop immediately: hammering a throttled feed helps nobody
      }
      /* one failed cell must not sink the sweep */
    }
    if (gapMs) await sleep(gapMs);
  }
  return out;
}
module.exports = { mapAc, fetchPoint, HUBS, WORLD_GRID, fetchSweep };
