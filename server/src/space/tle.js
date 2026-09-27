// Space Adapter (TLE): CelesTrak fetch (verified keyless) + satellite.js
// propagation. Fetcher accepted, never created (test seam).
const DEMO_TLE = require("../../data/demo-satellites.json").tle;
const TLE_URLS = (process.env.TLE_GROUPS || "stations,visual").split(",").map((g) =>
  `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(g.trim())}&FORMAT=tle`);
async function fetchText(url, { timeoutMs = 12000 } = {}) {
  let res;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "SkyTrack/0.1 (+https://github.com/sd967967-ship-it/PROJECT2)" },
    });
  } catch (e) {
    throw Object.assign(new Error("FEED_OFFLINE"), { code: "FEED_OFFLINE", cause: e });
  }
  if (res.status === 429) throw Object.assign(new Error("FEED_RATE_LIMITED"), { code: "FEED_RATE_LIMITED" });
  if (res.status === 401 || res.status === 403) throw Object.assign(new Error("FEED_UNAUTHORIZED"), { code: "FEED_UNAUTHORIZED" });
  if (!res.ok) throw Object.assign(new Error(`FEED_HTTP_${res.status}`), { code: "FEED_HTTP", status: res.status });
  return res.text();
}
function parseTle(text) {
  const lines = String(text || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const out = [];
  for (let i = 0; i + 2 < lines.length + 1; i++) {
    const a = lines[i], b = lines[i + 1], c = lines[i + 2];
    if (!b || !c) break;
    if (b.startsWith("1 ") && c.startsWith("2 ")) {
      out.push({ name: a, noradId: b.slice(2, 7).trim(), l1: b, l2: c });
      i += 2;
    }
  }
  return out;
}
async function fetchSets({ fetchTextFn = fetchText, urls = TLE_URLS } = {}) {
  const out = [];
  for (const u of urls) {
    try { out.push(...parseTle(await fetchTextFn(u))); }
    catch { /* one failed group must not sink the belt */ }
  }
  if (!out.length) throw Object.assign(new Error("FEED_OFFLINE"), { code: "FEED_OFFLINE" });
  return out;
}
function demoSets() { return parseTle(DEMO_TLE); }
function propagateToMovers(sets, now, sat, src) {
  const out = [];
  for (const s of sets) {
    try {
      const rec = sat.twoline2satrec(s.l1, s.l2);
      const pv = sat.propagate(rec, now);
      if (!pv || !pv.position || !pv.velocity) continue;
      const gmst = sat.gstime(now);
      const geo = sat.eciToGeodetic(pv.position, gmst);
      const lat = sat.degreesLat(geo.latitude);
      const lon = sat.degreesLong(geo.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const v = pv.velocity;
      const velKmh = Math.round(Math.hypot(v.x, v.y, v.z) * 3600);
      out.push({
        id: `sat-${s.noradId}`, domain: "space", kind: "satellite",
        lat, lon, altM: Math.round(geo.height * 1000),
        velKmh, hdg: null, label: s.name,
        meta: { noradId: s.noradId },
        src: src || "tle",
      });
    } catch { /* one bad element must not sink the belt */ }
  }
  return out;
}
// Hourly-refresh TLE store: live when fresh, demo fixture otherwise.
function createTleStore({ fetchSetsFn = fetchSets, refreshMs = Number(process.env.TLE_REFRESH_MS || 3600000) } = {}) {
  const store = { sets: demoSets(), t: 0, live: false, timer: null };
  async function refresh() {
    try {
      const sets = await fetchSetsFn();
      store.sets = sets; store.t = Date.now(); store.live = true;
    } catch { store.live = false; /* keep last sets, demo at boot */ }
    return store;
  }
  return {
    sets: () => store.sets,
    src: () => (store.live && Date.now() - store.t < 48 * 3600e3 ? "live" : "demo"),
    refresh,
    start() { if (!store.timer) { refresh(); store.timer = setInterval(refresh, refreshMs); } },
    stop() { clearInterval(store.timer); store.timer = null; },
  };
}
module.exports = { fetchText, parseTle, fetchSets, demoSets, propagateToMovers, createTleStore, TLE_URLS };
