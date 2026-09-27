const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeVessels, toMovers, fetchLive, demoVessels, ports } = require("../src/sea/aisAdapter");

test("sea normalizes generic + nested AIS rows, drops junk", () => {
  const out = normalizeVessels({
    vessels: [
      { mmsi: "123", shipname: "Alpha ", latitude: 10, longitude: 20, sog: 10, cog: 90, shiptype: "Tanker", flag: "PA", destination: "X" },
      { id: "456", name: "Beta", lat: -5, lon: 60, speed: 5, heading: 180 },
      { mmsi: "bad", lat: null, lon: 1 },
      null,
    ],
  });
  assert.equal(out.length, 2);
  assert.equal(out[0].name, "Alpha");
  assert.equal(out[0].src, "ais");
  assert.equal(out[1].mmsi, "456");
});
test("sea movers convert knots and carry domain", () => {
  const m = toMovers([{ mmsi: "1", name: "N", lat: 1, lon: 2, knots: 10, hdg: 45, type: "T", flag: "F", dest: "D", src: "ais" }], "live");
  assert.equal(m[0].velKmh, 19);
  assert.equal(m[0].domain, "sea");
  assert.equal(m[0].kind, "vessel");
  assert.equal(m[0].src, "live");
});
test("sea live requires a configured URL (parked otherwise)", async () => {
  await assert.rejects(() => fetchLive({ fetchJson: async () => ({}) }), /FEED_OFFLINE/);
  const live = await fetchLive({ fetchJson: async () => ({ body: [{ mmsi: "9", lat: 1, lon: 1 }] }), url: "https://example.invalid/vessels" });
  assert.equal(live.length, 1);
});
test("sea demo vessels + ports bundled", () => {
  assert.ok(demoVessels().length >= 5 && demoVessels().every((v) => v.src === "demo"));
  assert.ok(ports.length >= 10 && ports.every((p) => p.code && Number.isFinite(p.lat)));
});
