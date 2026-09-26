const { test } = require("node:test");
const assert = require("node:assert/strict");
const { haversineKm, arcPoints } = require("../helpers/geo");

test("U-GEO-01 haversine DEL->LHR within tolerance", () => {
  const d = haversineKm([28.57, 77.1], [51.47, -0.45]);
  assert.ok(Math.abs(d - 6710) < 100, `got ${d}`);
});
test("U-GEO-02 arc point count and endpoints", () => {
  const pts = arcPoints([0, 0], [10, 20], 40);
  assert.equal(pts.length, 41);
  assert.deepEqual(pts[0], [0, 0]);
  assert.deepEqual(pts[40], [10, 20]);
});
test("U-GEO-03 invalid n throws, antipodal finite", () => {
  assert.throws(() => arcPoints([0, 0], [1, 1], 0), RangeError);
  const d = haversineKm([0, 0], [0, 180]);
  assert.ok(Number.isFinite(d) && d > 19000 && d < 21000);
});
