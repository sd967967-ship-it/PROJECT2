// OpenSky Adapter: maps /states/all vectors to AircraftState. See LLD Ingestion Module.
const { fetchJson } = require("./fetchJson");
// Index map for OpenSky state vectors.
function mapStates(body) {
  if (!body || !Array.isArray(body.states)) throw Object.assign(new Error("FEED_INVALID"), { code: "FEED_INVALID" });
  const out = [];
  for (const s of body.states) {
    if (!Array.isArray(s) || s.length < 17) continue;
    const [hex, callsign, originCountry, , lastContact, lon, lat, baroAlt, onGround, vel, hdg, vs, , geoAlt, squawk] = s;
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    out.push({
      hex: String(hex || "").toLowerCase(),
      callsign: String(callsign || "").trim() || null,
      originCountry: originCountry || null,
      lat, lon,
      altM: typeof baroAlt === "number" ? baroAlt : (typeof geoAlt === "number" ? geoAlt : null),
      velMs: typeof vel === "number" ? vel : 0,
      hdg: typeof hdg === "number" ? hdg : null,
      vsMs: typeof vs === "number" ? vs : null,
      squawk: squawk || null,
      onGround: !!onGround,
      seenMs: 0,
      lastContactSec: typeof lastContact === "number" ? lastContact : null,
      type: null,
      src: "opensky",
    });
  }
  return out;
}
function statesUrl(bbox) {
  const base = "https://opensky-network.org/api/states/all";
  if (!bbox) return base;
  const p = new URLSearchParams({ lamin: bbox.lamin, lomin: bbox.lomin, lamax: bbox.lamax, lomax: bbox.lomax });
  return `${base}?${p}`;
}
function authHeader() {
  if (process.env.OPENSKY_USER && process.env.OPENSKY_PASS) {
    return { authorization: "Basic " + Buffer.from(`${process.env.OPENSKY_USER}:${process.env.OPENSKY_PASS}`).toString("base64") };
  }
  return {};
}
async function fetchAll(bbox) {
  const { body } = await fetchJson(statesUrl(bbox), { headers: authHeader() });
  return mapStates(body);
}
module.exports = { mapStates, statesUrl, fetchAll };
