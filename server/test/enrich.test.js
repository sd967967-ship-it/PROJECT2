const { test } = require("node:test");
const assert = require("node:assert/strict");
const { enrich } = require("../src/index");

test("enrich demo track has route, fares, flag iso", () => {
  const f = enrich({ hex: "a1b2c3", callsign: "AIC302", lat: 28.1, lon: 62.5, velKmh: 880, origin: "DEL", dest: "LHR", type: "B788" });
  assert.equal(f.airline.name, "Air India");
  assert.equal(f.iso, "in");
  assert.ok(f.route.distKm > 6000);
  assert.equal(f.fares.eco.confidence, "low/modeled");
  assert.ok(f.route.arc.length === 49);
});
test("enrich position-only track omits route and fares", () => {
  const f = enrich({ hex: "x", callsign: "N12345", lat: 0, lon: 0, velKmh: 400, origin: null, dest: null, type: null });
  assert.equal(f.route, null);
  assert.equal(f.fares, null);
  assert.equal(f.capacity.confidence, "low");
});
