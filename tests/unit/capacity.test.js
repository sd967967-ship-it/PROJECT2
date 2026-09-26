const { test } = require("node:test");
const assert = require("node:assert/strict");
const { getCapacity } = require("../helpers/capacity");

test("U-CAP-01 known type high confidence", () => {
  assert.deepEqual(getCapacity("B788"), { seats: 256, source: "static", confidence: "high" });
});
test("U-CAP-02 unknown type falls back low confidence", () => {
  const c = getCapacity("ZZZ");
  assert.equal(c.confidence, "low");
  assert.ok(c.seats > 0);
});
