const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeVehicles, toMovers, fetchLive, demoVehicles, stops } = require("../src/streets/transitAdapter");

test("streets normalizes generic + nested vehicle rows, drops junk", () => {
  const out = normalizeVehicles({
    data: [
      { vehicleId: "T1", line: "Blue", latitude: 28.6, longitude: 77.2, velocity: 34, bearing: 90, status: "running", next_stop: "X" },
      { id: "T2", route: "Red", lat: 0, lon: 0 },
      { id: "bad", lat: null, lon: 0 },
    ],
  });
  assert.equal(out.length, 2);
  assert.equal(out[0].route, "Blue");
  assert.equal(out[0].next, "X");
  assert.equal(out[0].src, "transit");
});
test("streets movers carry domain and status", () => {
  const m = toMovers([{ id: "T1", route: "Blue", lat: 1, lon: 2, kmh: 33, hdg: 9, status: "dwell", next: "Y", src: "demo" }], "demo");
  assert.equal(m[0].label, "Blue · T1");
  assert.equal(m[0].domain, "streets");
  assert.equal(m[0].meta.status, "dwell");
});
test("streets live requires a configured URL (parked otherwise)", async () => {
  await assert.rejects(() => fetchLive({ fetchJson: async () => ({}) }), /FEED_OFFLINE/);
});
test("streets demo vehicles + stops bundled", () => {
  assert.ok(demoVehicles().length >= 5 && demoVehicles().every((v) => v.src === "demo"));
  assert.ok(stops.length >= 10 && stops.every((s) => s.id && Number.isFinite(s.lat)));
});
