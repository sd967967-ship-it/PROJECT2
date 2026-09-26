const { test } = require("node:test");
const assert = require("node:assert/strict");
const { RouteCache, pickRoute } = require("../src/routes");

test("pickRoute prefers latest arrived flight", () => {
  const r = pickRoute([
    { estDepartureAirport: "VIDP", estArrivalAirport: null, lastSeen: 3 },
    { estDepartureAirport: "VIDP", estArrivalAirport: "EGLL", lastSeen: 2 },
    { estDepartureAirport: "OMDB", estArrivalAirport: "VABB", lastSeen: 9 },
  ]);
  assert.deepEqual(r, { originIcao: "OMDB", destIcao: "VABB", callsign: null });
});
test("pickRoute empty/null safe", () => {
  assert.equal(pickRoute([]), null);
  assert.equal(pickRoute(null), null);
});
test("cache serves positive then refetches after TTL", async () => {
  let calls = 0;
  const c = new RouteCache({ fetchRoute: async () => { calls++; return { originIcao: "A", destIcao: "B" }; }, posTtlMs: 30, negTtlMs: 30 });
  assert.deepEqual(await c.resolve("ab"), { originIcao: "A", destIcao: "B" });
  assert.deepEqual(await c.resolve("ab"), { originIcao: "A", destIcao: "B" });
  assert.equal(calls, 1);
  await new Promise((r) => setTimeout(r, 40));
  await c.resolve("ab");
  assert.equal(calls, 2);
});
test("negative results cached, fetcher errors cached as null", async () => {
  let calls = 0;
  const c = new RouteCache({ fetchRoute: async () => { calls++; throw new Error("x"); }, negTtlMs: 60000 });
  assert.equal(await c.resolve("zz"), null);
  assert.equal(await c.resolve("zz"), null);
  assert.equal(calls, 1);
});
