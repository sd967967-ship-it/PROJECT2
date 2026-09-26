const { test } = require("node:test");
const assert = require("node:assert/strict");
const { fuse } = require("../src/fusion/fuse");
const { haversineKm, arcPoints, nearestAirport } = require("../src/fusion/geo");
const { etaFor } = require("../src/fusion/eta");
const { getCapacity } = require("../src/capacity");
const { estimateFares } = require("../src/pricing");
const { airlineOf, getServices } = require("../src/services");

test("fuse dedupes freshest, drops stale and junk", () => {
  const now = Date.now();
  const out = fuse([
    { hex: "a", lat: 1, lon: 1, seenMs: 5000, src: "x" },
    { hex: "a", lat: 1.1, lon: 1.1, seenMs: 500, src: "x" },
    { hex: "b", lat: 2, lon: 2, seenMs: 999999, src: "x" },
    { hex: null, lat: 0, lon: 0 },
  ], { now });
  assert.equal(out.length, 1);
  assert.equal(out[0].lat, 1.1);
});
test("geo: haversine + eta null-safe", () => {
  assert.ok(Math.abs(haversineKm([28.57, 77.1], [51.47, -0.45]) - 6710) < 100);
  assert.equal(arcPoints([0, 0], [1, 1], 4).length, 5);
  assert.deepEqual(etaFor(1000, 0), { remainH: null, etaUtc: null });
  assert.ok(etaFor(880, 880).remainH === 1);
});
test("nearest airport resolves hub", () => {
  const ap = [{ iata: "DEL", lat: 28.57, lon: 77.1 }];
  assert.equal(nearestAirport(28.6, 77.2, ap).iata, "DEL");
});
test("capacity + services + fares contracts", () => {
  assert.equal(getCapacity("B77W").seats, 396);
  assert.equal(getCapacity("ZZZ").confidence, "low");
  assert.equal(airlineOf("AIC302").name, "Air India");
  assert.equal(airlineOf("ZZZ999"), null);
  assert.ok(getServices("ZZZ999").unknown);
  assert.equal(estimateFares(1000).eco.avg, 120);
});
