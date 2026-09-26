const { test } = require("node:test");
const assert = require("node:assert/strict");
const { estimateFares } = require("../helpers/fares");

test("U-FARE-01 per-class math at 1000km", () => {
  const f = estimateFares(1000);
  assert.equal(f.eco.avg, 120);
  assert.equal(f.prem.avg, 168);
  assert.equal(f.biz.avg, 300);
  assert.equal(f.first.avg, 480);
  for (const c of Object.values(f)) assert.equal(c.confidence, "low/modeled");
});
test("U-FARE-02 zero distance yields zeros", () => {
  const f = estimateFares(0);
  assert.equal(f.eco.avg, 0);
});
test("U-FARE-03 negative and NaN throw", () => {
  assert.throws(() => estimateFares(-1), RangeError);
  assert.throws(() => estimateFares(NaN), TypeError);
});
