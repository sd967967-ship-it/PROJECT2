// Streets live rail: Finland Digitraffic open JSON (documented at
// digitraffic.fi, keyless). Fetcher accepted, never created.
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function str(v) { const s = String(v ?? "").trim(); return s || null; }
function normalizeTrains(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const out = [];
  for (const r of list) {
    if (!r || typeof r !== "object") continue;
    const c = r.location && r.location.coordinates;
    const lon = Array.isArray(c) ? num(c[0]) : null;
    const lat = Array.isArray(c) ? num(c[1]) : null;
    const n = num(r.trainNumber);
    if (r.trainNumber == null || r.trainNumber === "" || n == null) continue;
    if (lat == null || lon == null) continue;
    out.push({
      number: n,
      date: str(r.departureDate),
      lat, lon,
      kmh: num(r.speed) != null ? r.speed * 3.6 : 0,
      gps: r.isGpsLocation !== false,
      timeUtc: str(r.timestamp),
      seenMs: 0, src: "digitraffic",
    });
  }
  return out;
}
function toMovers(trains, src) {
  return trains.map((t) => ({
    id: `fi-${t.number}-${t.date || "nodate"}`, domain: "streets", kind: "vehicle",
    lat: t.lat, lon: t.lon, altM: 0,
    velKmh: Math.round(t.kmh || 0),
    hdg: null,
    label: `Train ${t.number}`,
    meta: { system: "rail", country: "FI", route: `Train ${t.number}`, status: t.gps ? "gps" : "estimated" },
    src: src || t.src || "digitraffic",
  }));
}
async function fetchLive({ fetchJson } = {}) {
  const { body } = await fetchJson("https://rata.digitraffic.fi/api/v1/train-locations/latest/");
  return normalizeTrains(body);
}
module.exports = { normalizeTrains, toMovers, fetchLive };
