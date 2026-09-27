// Ingestion internal seam: timed JSON fetch with typed errors. Host allowlist
// enforced (SSRF defense in depth): only documented provider hosts + localhost.
const ALLOW_HOSTS = new Set([
  "opensky-network.org", "api.adsb.lol", "celestrak.org",
  "earthquake.usgs.gov", "eonet.gsfc.nasa.gov",
  "api.open-meteo.com", "air-quality-api.open-meteo.com",
  "services.swpc.noaa.gov", "ssd-api.jpl.nasa.gov",
  "api.entur.io", "rata.digitraffic.fi", "api.irishrail.ie",
  "localhost", "127.0.0.1", "::1",
]);
async function fetchJson(url, { timeoutMs = 8000, headers = {}, method = "GET", json, response = "json" } = {}) {
  let host = "";
  try { host = new URL(url).hostname.toLowerCase(); }
  catch { throw Object.assign(new Error("FEED_FORBIDDEN"), { code: "FEED_FORBIDDEN" }); }
  if (!ALLOW_HOSTS.has(host)) throw Object.assign(new Error("FEED_FORBIDDEN"), { code: "FEED_FORBIDDEN", host });
  let res;
  const init = {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "user-agent": "SkyTrack/0.1 (+https://github.com/sd967967-ship-it/PROJECT2)", ...headers },
  };
  if (method && method !== "GET") init.method = method;
  if (json !== undefined) {
    init.body = JSON.stringify(json);
    init.headers = { "content-type": "application/json", ...init.headers };
  }
  try {
    res = await fetch(url, init);
  } catch (e) {
    const err = new Error("FEED_OFFLINE");
    err.code = "FEED_OFFLINE"; err.cause = e; throw err;
  }
  if (res.status === 429) {
    const err = new Error("FEED_RATE_LIMITED");
    err.code = "FEED_RATE_LIMITED";
    err.retryAfterMs = Number(res.headers.get("retry-after") || 30) * 1000;
    throw err;
  }
  if (res.status === 401 || res.status === 403) {
    const err = new Error("FEED_UNAUTHORIZED"); err.code = "FEED_UNAUTHORIZED"; throw err;
  }
  if (!res.ok) {
    const err = new Error(`FEED_HTTP_${res.status}`); err.code = "FEED_HTTP"; err.status = res.status; throw err;
  }
  try {
    if (response === "text") return { status: res.status, headers: res.headers, body: await res.text() };
    return { status: res.status, headers: res.headers, body: await res.json() };
  } catch (e) {
    const err = new Error("FEED_INVALID"); err.code = "FEED_INVALID"; err.cause = e; throw err;
  }
}
module.exports = { fetchJson };
