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
const HUBS = [[28.57, 77.1], [51.47, -0.45], [40.64, -73.78], [1.36, 103.99]];
async function fetchPoint(lat, lon, radiusNm = 250) {
  const { body } = await fetchJson(`https://api.adsb.lol/v2/point/${lat}/${lon}/${radiusNm}`);
  return mapAc(body);
}
module.exports = { mapAc, fetchPoint, HUBS };
