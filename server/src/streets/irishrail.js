// Streets live rail: Irish Rail open XML (documented at api.irishrail.ie,
// keyless; HTTPS). Local text fetcher because fetchJson is JSON-only.
// Fetcher accepted, never created (test seam).
const { XMLParser } = require("fast-xml-parser");
const parser = new XMLParser({ ignoreAttributes: true, trimValues: true });
async function fetchText(url, { timeoutMs = 12000 } = {}) {
  let res;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "SkyTrack/0.1 (+https://github.com/sd967967-ship-it/PROJECT2)", accept: "application/xml" },
    });
  } catch (e) {
    throw Object.assign(new Error("FEED_OFFLINE"), { code: "FEED_OFFLINE", cause: e });
  }
  if (res.status === 429) throw Object.assign(new Error("FEED_RATE_LIMITED"), { code: "FEED_RATE_LIMITED" });
  if (!res.ok) throw Object.assign(new Error(`FEED_HTTP_${res.status}`), { code: "FEED_HTTP", status: res.status });
  return res.text();
}
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function str(v) { const s = String(v ?? "").trim(); return s || null; }
function parseTrainsXml(text) {
  let doc;
  try { doc = parser.parse(String(text || "")); }
  catch { throw Object.assign(new Error("FEED_INVALID"), { code: "FEED_INVALID" }); }
  const root = doc && doc.ArrayOfObjTrainPositions;
  const rows = root ? root.objTrainPositions : null;
  if (!rows) throw Object.assign(new Error("FEED_INVALID"), { code: "FEED_INVALID" });
  return normalizeTrains([].concat(rows));
}
function normalizeTrains(rows) {
  const out = [];
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const lat = num(r.TrainLatitude), lon = num(r.TrainLongitude);
    const code = str(r.TrainCode);
    if (lat == null || lon == null || !code) continue;
    out.push({
      code, lat, lon,
      dir: str(r.Direction),
      message: str(r.PublicMessage),
      status: str(r.TrainStatus),
      origin: str(r.TrainOrigin), dest: str(r.TrainDestination),
      seenMs: 0, src: "irishrail",
    });
  }
  return out;
}
function toMovers(trains, src) {
  return trains.map((t) => ({
    id: `ie-${t.code}`, domain: "streets", kind: "vehicle",
    lat: t.lat, lon: t.lon, altM: 0,
    velKmh: null, hdg: null,
    label: `${t.code}${t.dest ? ` → ${t.dest}` : ""}`,
    meta: { system: "rail", country: "IE", route: t.code, status: t.status, next: t.dest, message: t.message },
    src: src || t.src || "irishrail",
  }));
}
async function fetchLive({ fetchTextFn = fetchText } = {}) {
  return parseTrainsXml(await fetchTextFn("https://api.irishrail.ie/realtime/realtime.asmx/getCurrentTrainsXML"));
}
module.exports = { fetchText, parseTrainsXml, normalizeTrains, toMovers, fetchLive };
