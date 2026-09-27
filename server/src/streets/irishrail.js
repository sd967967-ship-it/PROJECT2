// Streets live rail: Irish Rail open XML (documented at api.irishrail.ie,
// keyless; HTTPS). Text bodies go through the shared fetchJson seam (SSRF
// allowlist included). Fetcher accepted, never created (test seam).
const { XMLParser } = require("fast-xml-parser");
const { fetchJson } = require("../ingestion/fetchJson");
const parser = new XMLParser({ ignoreAttributes: true, trimValues: true });
async function fetchText(url, { timeoutMs = 12000 } = {}) {
  const { body } = await fetchJson(url, { response: "text", timeoutMs, headers: { accept: "application/xml" } });
  return body;
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
