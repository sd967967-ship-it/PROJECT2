// Test-only feed client mirror: fetch snapshot with timeout + typed errors. No app code.
async function fetchSnapshot(baseUrl, { timeoutMs = 2000 } = {}) {
  let res;
  try {
    res = await fetch(`${baseUrl}/snapshot`, { signal: AbortSignal.timeout(timeoutMs) });
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
  if (!res.ok) {
    const err = new Error(`FEED_HTTP_${res.status}`);
    err.code = "FEED_HTTP"; throw err;
  }
  try {
    const body = await res.json();
    if (!body || !Array.isArray(body.states)) throw new Error("missing states[]");
    return { data: body, stale: false };
  } catch (e) {
    const err = new Error("FEED_INVALID");
    err.code = "FEED_INVALID"; err.cause = e; throw err;
  }
}
module.exports = { fetchSnapshot };
