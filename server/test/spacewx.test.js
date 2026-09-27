const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseKp, fetchKp, normalizeFireballs, fetchFireballs } = require("../src/geo/spacewx");

test("kp parses latest row with storm level", () => {
  const k = parseKp([{ time_tag: "t1", estimated_kp: 2.0 }, { time_tag: "t2", estimated_kp: 6.33 }]);
  assert.equal(k.kp, 6.33);
  assert.equal(k.level, "moderate storm");
  assert.equal(k.src, "swpc");
  assert.throws(() => parseKp([]), /FEED_INVALID/);
  assert.throws(() => parseKp([{ estimated_kp: "x" }]), /FEED_INVALID/);
});
test("kp live fetch maps through fetcher seam", async () => {
  const k = await fetchKp({ fetchJson: async () => ({ body: [{ time_tag: "t", estimated_kp: 1 }] }) });
  assert.equal(k.level, "quiet");
});
test("fireballs normalize JPL rows, drop bad coords", () => {
  const out = normalizeFireballs({ fields: ["date", "energy", "lat", "lon", "vel"], data: [
    ["2026-01-01", "0.5", "10", "20", "18"],
    ["2026-01-02", null, "x", "20", null],
  ] });
  assert.equal(out.length, 1);
  assert.equal(out[0].energyKt, 0.5);
  assert.equal(out[0].velKms, 18);
  assert.equal(out[0].src, "cneos");
  assert.throws(() => normalizeFireballs({}), /FEED_INVALID/);
});
test("fireballs clamp limit", async () => {
  let url = "";
  await fetchFireballs({ fetchJson: async (u) => { url = u; return { body: { fields: ["date", "lat", "lon"], data: [] } }; }, limit: 9999 });
  assert.ok(url.includes("limit=200"));
});
