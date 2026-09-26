// Fusion Module: dedupe by hex (freshest wins), drop stale, derive display fields.
const { nearestAirport } = require("./geo");
const STALE_MS = 120000;
function fuse(states, { airports = [], now = Date.now() } = {}) {
  const byHex = new Map();
  for (const s of states) {
    if (!s || !s.hex || !Number.isFinite(s.lat) || !Number.isFinite(s.lon)) continue;
    const ageMs = s.lastContactSec ? now - s.lastContactSec * 1000 : (s.seenMs || 0);
    if (ageMs > STALE_MS) continue;
    const prev = byHex.get(s.hex);
    if (!prev || ageMs < prev._age) byHex.set(s.hex, { ...s, _age: ageMs });
  }
  const out = [];
  for (const s of byHex.values()) {
    const velKmh = Math.round((s.velMs || 0) * 3.6);
    out.push({
      hex: s.hex,
      callsign: s.callsign,
      lat: s.lat, lon: s.lon,
      altM: s.altM, velKmh,
      hdg: s.hdg, vsMs: s.vsMs, squawk: s.squawk,
      onGround: !!s.onGround,
      originCountry: s.originCountry || null,
      type: s.type || null,
      origin: null, dest: null, // route unknown from ADS-B alone; UI shows position-only
      near: airports.length ? nearestAirport(s.lat, s.lon, airports) : null,
      src: s.src || "unknown",
    });
    delete out[out.length - 1]._age;
  }
  return out;
}
module.exports = { fuse, STALE_MS };
