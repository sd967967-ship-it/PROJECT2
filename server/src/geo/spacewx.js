// Space-weather Module: NOAA SWPC planetary Kp + CNEOS fireballs. Public
// domain, credit SWPC / NASA CNEOS. TLE positions stay predictions, never
// precise real-time claims (see dossier copy).
function parseKp(body) {
  if (!Array.isArray(body) || !body.length) throw Object.assign(new Error("FEED_INVALID"), { code: "FEED_INVALID" });
  const row = body[body.length - 1];
  const kp = Number(row.estimated_kp ?? row.kp_index ?? row.kp);
  if (!Number.isFinite(kp)) throw Object.assign(new Error("FEED_INVALID"), { code: "FEED_INVALID" });
  const level = kp < 4 ? "quiet" : kp < 5 ? "unsettled" : kp < 6 ? "minor storm" : kp < 7 ? "moderate storm" : "strong storm";
  return { kp: +kp.toFixed(2), level, timeUtc: row.time_tag || null, src: "swpc" };
}
async function fetchKp({ fetchJson } = {}) {
  const { body } = await fetchJson("https://services.swpc.noaa.gov/json/planetary_k_index_1m.json");
  return parseKp(body);
}
function normalizeFireballs(body) {
  if (!body || !Array.isArray(body.data) || !Array.isArray(body.fields)) {
    throw Object.assign(new Error("FEED_INVALID"), { code: "FEED_INVALID" });
  }
  const ix = (n) => body.fields.indexOf(n);
  const iLat = ix("lat"), iLon = ix("lon"), iDate = ix("date"), iEnergy = ix("energy"), iVel = ix("vel");
  const out = [];
  for (const r of body.data) {
    const lat = Number(r[iLat]), lon = Number(r[iLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({
      id: `fb-${r[iDate]}-${lat}-${lon}`,
      lat, lon,
      dateUtc: r[iDate] || null,
      energyKt: r[iEnergy] != null ? Number(r[iEnergy]) : null,
      velKms: r[iVel] != null ? Number(r[iVel]) : null,
      src: "cneos",
    });
  }
  return out;
}
async function fetchFireballs({ fetchJson, limit = 60 } = {}) {
  const { body } = await fetchJson(`https://ssd-api.jpl.nasa.gov/fireball.api?limit=${Math.min(Math.max(Number(limit) || 60, 1), 200)}`);
  return normalizeFireballs(body);
}
module.exports = { parseKp, fetchKp, normalizeFireballs, fetchFireballs };
