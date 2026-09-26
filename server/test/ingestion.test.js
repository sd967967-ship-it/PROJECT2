const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mapStates } = require("../src/ingestion/openskyAdapter");
const { mapAc, WORLD_GRID, fetchSweep } = require("../src/ingestion/adsbLolAdapter");
const { Poller } = require("../src/ingestion/poller");

test("opensky maps state vector", () => {
  const out = mapStates({ states: [["a1b2c3", "AIC302 ", "India", 1, 1727220000, 62.5, 28.1, 11500, false, 244.4, 290, 0, null, 11600, "1234", false, 0]] });
  assert.equal(out.length, 1);
  assert.equal(out[0].callsign, "AIC302");
  assert.equal(out[0].src, "opensky");
});
test("opensky drops rows without lat/lon", () => {
  assert.deepEqual(mapStates({ states: [["x", null, null, 1, 1, null, null, 1, false, 1, 1, 1, null, 1, null, false, 0]] }), []);
});
test("adsb.lol maps ac rows with unit conversion", () => {
  const out = mapAc({ ac: [{ hex: "A1B2C3", flight: "BAW249 ", lat: 45.5, lon: -20, alt_baro: 38000, gs: 450, track: 260, t: "B77W", seen: 1 }] });
  assert.equal(out[0].hex, "a1b2c3");
  assert.equal(out[0].type, "B77W");
  assert.ok(Math.abs(out[0].velMs - 231.5) < 1);
});
test("sweep covers a 43-point world grid and merges groups", async () => {
  assert.ok(WORLD_GRID.length >= 40);
  const seen = [];
  const rows = await fetchSweep([[1, 1], [2, 2]], { gapMs: 0, fetchFn: async (la, lo) => { seen.push([la, lo]); return [{ hex: `h${la}`, lat: la, lon: lo }]; } });
  assert.deepEqual(seen, [[1, 1], [2, 2]]);
  assert.equal(rows.length, 2);
});
test("sweep survives a failing cell", async () => {
  const rows = await fetchSweep([[1, 1]], { gapMs: 0, fetchFn: async () => { throw new Error("x"); } });
  assert.deepEqual(rows, []);
});
test("poller backs off on rate-limit, recovers after", async () => {
  let calls = 0;
  const p = new Poller({
    fetchPrimary: async () => { calls++; throw Object.assign(new Error("rl"), { code: "FEED_RATE_LIMITED" }); },
    maxBackoffMs: 60000,
  });
  await p.cycle();
  assert.equal(calls, 1);
  await p.cycle(); // backed off: no new fetch
  assert.equal(calls, 1);
  p.backoffUntil = Date.now() - 1;
  p.fetchPrimary = async () => { calls++; return [{ hex: "a", lat: 1, lon: 1 }]; };
  await p.cycle();
  assert.equal(p.getSnapshot().src, "live");
});
test("backed-off poller still sweeps the keyless fallback", async () => {
  let primary = 0, fallback = 0;
  const p = new Poller({
    fetchPrimary: async () => { primary++; throw Object.assign(new Error("rl"), { code: "FEED_RATE_LIMITED" }); },
    fetchFallback: async () => { fallback++; return [{ hex: "a", lat: 1, lon: 1 }]; },
    maxBackoffMs: 60000,
  });
  await p.cycle(); // fail#1: no fallback yet
  assert.equal(fallback, 0);
  await p.cycle(); // fail#2 -> fallback + backoff armed
  assert.equal(fallback, 1);
  await p.cycle(); // backed off: primary untouched, fallback still sweeps
  assert.equal(primary, 2);
  assert.equal(fallback, 2);
  assert.equal(p.getSnapshot().src, "fallback");
});
  let calls = 0;
  const p = new Poller({
    fetchPrimary: async () => { calls++; await new Promise((r) => setTimeout(r, 50)); return [{ hex: "a", lat: 1, lon: 1 }]; },
  });
  await Promise.all([p.cycle(), p.cycle(), p.cycle()]);
  assert.equal(calls, 1);
  assert.equal(p.getSnapshot().src, "live");
});
test("poller caches, falls back, serves stale", async () => {
  let n = 0;
  const p = new Poller({
    fetchPrimary: async () => { n++; if (n < 3) throw Object.assign(new Error("x"), { code: "FEED_OFFLINE" }); return [{ hex: "a", lat: 1, lon: 1 }]; },
    fetchFallback: async () => [{ hex: "b", lat: 2, lon: 2 }],
  });
  await p.cycle();
  assert.equal(p.getSnapshot().states.length, 0);
  await p.cycle(); // 2nd fail -> fallback
  assert.equal(p.getSnapshot().src, "fallback");
  await p.cycle(); // primary recovers
  assert.equal(p.getSnapshot().src, "live");
});
