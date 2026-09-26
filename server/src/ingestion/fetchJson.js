// Ingestion internal seam: timed JSON fetch with typed errors. No app behavior elsewhere.
async function fetchJson(url, { timeoutMs = 8000, headers = {} } = {}) {
  let res;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "SkyTrack/0.1 (+https://github.com/sd967967-ship-it/PROJECT2)", ...headers },
    });
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
    return { status: res.status, headers: res.headers, body: await res.json() };
  } catch (e) {
    const err = new Error("FEED_INVALID"); err.code = "FEED_INVALID"; err.cause = e; throw err;
  }
}
module.exports = { fetchJson };
