const { test } = require("node:test");
const assert = require("node:assert/strict");
const mock = require("../mocks/feed.mock");
const { fetchSnapshot } = require("../helpers/feedClient");

test("I-FEED-01 ok snapshot normalizes to 3 tracks", async () => {
  const { srv, url } = await mock.start("ok");
  try {
    const { data, stale } = await fetchSnapshot(url);
    assert.equal(stale, false);
    assert.equal(data.states.length, 3);
    for (const s of data.states) assert.ok(s.hex && Number.isFinite(s.lat));
  } finally { srv.close(); }
});
test("I-FEED-02 empty snapshot flagged, not error", async () => {
  const { srv, url } = await mock.start("empty");
  try {
    const { data } = await fetchSnapshot(url);
    assert.deepEqual(data.states, []);
  } finally { srv.close(); }
});
test("I-FEED-03 invalid JSON maps to FEED_INVALID", async () => {
  const { srv, url } = await mock.start("invalid");
  try {
    await assert.rejects(() => fetchSnapshot(url), (e) => e.code === "FEED_INVALID");
  } finally { srv.close(); }
});
test("I-FAIL-01 429 maps to FEED_RATE_LIMITED with retryAfter", async () => {
  const { srv, url } = await mock.start("denied");
  try {
    await assert.rejects(() => fetchSnapshot(url), (e) => e.code === "FEED_RATE_LIMITED" && e.retryAfterMs === 30000);
  } finally { srv.close(); }
});
test("I-FAIL-02 slow feed times out to FEED_OFFLINE", async () => {
  const { srv, url } = await mock.start("slow");
  try {
    await assert.rejects(() => fetchSnapshot(url, { timeoutMs: 500 }), (e) => e.code === "FEED_OFFLINE");
  } finally { srv.close(); }
});
test("I-OFF-01 refused connection maps to FEED_OFFLINE", async () => {
  await assert.rejects(() => fetchSnapshot("http://127.0.0.1:1", { timeoutMs: 500 }), (e) => e.code === "FEED_OFFLINE");
});
