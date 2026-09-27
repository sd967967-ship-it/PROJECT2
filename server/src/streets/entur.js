// Streets live board: Entur JourneyPlanner (Norway — open, keyless, documented
// at developer.entur.org; ET-Client-Name header required by their terms).
// Returns departures with the API's own realtime/scheduled flags, never faked.
const API = "https://api.entur.io/journey-planner/v3/graphql";
const BOARD_TTL_MS = 60e3;
const cache = new Map(); // stopId -> {t, stop, departures}
async function gql(fetchJson, query) {
  const { body } = await fetchJson(API, {
    method: "POST",
    headers: { "ET-Client-Name": "skytrack" },
    json: { query },
  });
  if (!body || !body.data) throw Object.assign(new Error("FEED_INVALID"), { code: "FEED_INVALID" });
  return body.data;
}
function bboxFor(lat, lon, radiusKm = 2) {
  const dLat = radiusKm / 111.32;
  const dLon = radiusKm / (111.32 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
  return { minLat: lat - dLat, minLon: lon - dLon, maxLat: lat + dLat, maxLon: lon + dLon };
}
function str(v) { const s = String(v ?? "").trim(); return s || null; }
function normalizeDepartures(calls) {
  const out = [];
  for (const c of [].concat(calls || [])) {
    const dest = str(c.destinationDisplay && c.destinationDisplay.frontText);
    const line = str(c.serviceJourney && c.serviceJourney.line && c.serviceJourney.line.publicCode);
    const aimed = Date.parse(c.aimedDepartureTime);
    const expected = Date.parse(c.expectedDepartureTime);
    if (!dest || !Number.isFinite(aimed)) continue;
    out.push({
      line, mode: str(c.serviceJourney && c.serviceJourney.line && c.serviceJourney.line.transportMode),
      destination: dest,
      aimedUtc: new Date(aimed).toISOString(),
      expectedUtc: Number.isFinite(expected) ? new Date(expected).toISOString() : null,
      delayMin: Number.isFinite(expected) ? Math.round((expected - aimed) / 60000) : 0,
      realtime: c.realtime !== false,
    });
  }
  return out;
}
async function fetchBoard({ fetchJson, lat, lon, radiusKm = 2, count = 8 } = {}) {
  const la = Number(lat), lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) {
    throw Object.assign(new Error("bad lat/lon"), { code: "BAD_INPUT", status: 400 });
  }
  const b = bboxFor(la, lo, radiusKm);
  const found = await gql(fetchJson,
    `{ stopPlacesByBbox(minimumLatitude: ${b.minLat}, minimumLongitude: ${b.minLon}, maximumLatitude: ${b.maxLat}, maximumLongitude: ${b.maxLon}) { id name } }`);
  const stops = (found.stopPlacesByBbox || []).filter((s) => s && s.id);
  if (!stops.length) return { stop: null, departures: [], note: "no Entur stops within range (Norway coverage)" };
  const stop = stops[0];
  if (!/^[A-Za-z0-9:._-]+$/.test(stop.id)) throw Object.assign(new Error("FEED_INVALID"), { code: "FEED_INVALID" });
  const now = Date.now();
  const hit = cache.get(stop.id);
  if (hit && now - hit.t < BOARD_TTL_MS) return { ...hit, cached: true };
  const detail = await gql(fetchJson,
    `{ stopPlace(id: "${stop.id}") { name estimatedCalls(timeRange: 3600, numberOfDepartures: ${Math.min(Math.max(Number(count) || 8, 1), 20)}) { aimedDepartureTime expectedDepartureTime realtime destinationDisplay { frontText } serviceJourney { line { publicCode transportMode } } } } }`);
  const departures = normalizeDepartures(detail.stopPlace && detail.stopPlace.estimatedCalls);
  const out = { stop: { id: stop.id, name: (detail.stopPlace && detail.stopPlace.name) || stop.name }, departures };
  if (cache.size > 200) cache.clear();
  cache.set(stop.id, { t: now, ...out });
  return { ...out, cached: false };
}
module.exports = { fetchBoard, normalizeDepartures, bboxFor, BOARD_TTL_MS };
