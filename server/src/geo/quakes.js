// Hazards Module: USGS FDSNWS earthquakes -> normalized events. Fetcher
// accepted, never created (test seam). Public domain, credit USGS.
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function normalizeQuakes(body) {
  if (!body || !Array.isArray(body.features)) throw Object.assign(new Error("FEED_INVALID"), { code: "FEED_INVALID" });
  const out = [];
  for (const f of body.features) {
    const p = (f && f.properties) || {};
    const c = f && f.geometry && f.geometry.coordinates;
    if (!Array.isArray(c) || typeof c[0] !== "number" || typeof c[1] !== "number") continue;
    const mag = num(p.mag);
    out.push({
      id: String(f.id || p.code || `${c[1]},${c[0]},${p.time || 0}`),
      lat: c[1], lon: c[0], depthKm: typeof c[2] === "number" ? c[2] : null,
      mag, place: typeof p.title === "string" ? p.title : (typeof p.place === "string" ? p.place : "earthquake"),
      timeMs: typeof p.time === "number" ? p.time : null,
      url: typeof p.url === "string" ? p.url : null,
      status: p.status === "reviewed" ? "reviewed" : "preliminary",
      src: "usgs",
    });
  }
  return out;
}
function quakesUrl({ minMag = 4.5, limit = 100 } = {}) {
  const p = new URLSearchParams({ format: "geojson", minmagnitude: String(minMag), limit: String(limit), orderby: "time" });
  return `https://earthquake.usgs.gov/fdsnws/event/1/query?${p}`;
}
async function fetchQuakes({ fetchJson, minMag = 4.5, limit = 100 } = {}) {
  const { body } = await fetchJson(quakesUrl({ minMag, limit }));
  return normalizeQuakes(body);
}
module.exports = { normalizeQuakes, quakesUrl, fetchQuakes };
