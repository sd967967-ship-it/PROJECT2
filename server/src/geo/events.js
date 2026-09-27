// Hazards Module: NASA EONET natural events -> normalized events. Fetcher
// accepted, never created. Public domain, credit NASA. Categories curated to
// map-safe phenomena (no exact-address or personal data involved).
const WANT = new Set(["earthquakes", "volcanoes", "wildfires", "storms", "floods", "drought", "dustHaze", "landslides", "snow", "tempExtremes", "waterColor"]);
function str(v) { const s = String(v ?? "").trim(); return s || null; }
function normalizeEvents(body) {
  const rows = body && Array.isArray(body.events) ? body.events : null;
  if (!rows) throw Object.assign(new Error("FEED_INVALID"), { code: "FEED_INVALID" });
  const out = [];
  for (const e of rows) {
    const cats = Array.isArray(e.categories) ? e.categories.map((c) => c.id).filter((id) => WANT.has(id)) : [];
    if (!cats.length) continue;
    const geoms = Array.isArray(e.geometry) ? e.geometry : [];
    const g = geoms[geoms.length - 1];
    const c = g && g.coordinates;
    // Points only: polygons need simplification budgets we don't spend day-1.
    if (!Array.isArray(c) || typeof c[0] !== "number" || typeof c[1] !== "number") continue;
    out.push({
      id: str(e.id) || `${c[1]},${c[0]}`,
      lat: c[1], lon: c[0],
      title: str(e.title) || cats[0],
      categories: cats,
      closed: e.closed != null,
      timeMs: g.date ? Date.parse(g.date) || null : null,
      sources: Array.isArray(e.sources) ? e.sources.map((s) => s.url).filter(Boolean).slice(0, 2) : [],
      src: "eonet",
    });
  }
  return out;
}
async function fetchEvents({ fetchJson, days = 30, limit = 200 } = {}) {
  const p = new URLSearchParams({ days: String(days), limit: String(limit), status: "open" });
  const { body } = await fetchJson(`https://eonet.gsfc.nasa.gov/api/v2.1/events?${p}`);
  return normalizeEvents(body);
}
module.exports = { normalizeEvents, fetchEvents, WANT };
