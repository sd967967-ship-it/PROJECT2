const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeQuakes, quakesUrl, fetchQuakes } = require("../src/geo/quakes");
const { normalizeEvents, fetchEvents } = require("../src/geo/events");

test("quakes normalize GeoJSON, mark reviewed vs preliminary", () => {
  const out = normalizeQuakes({ features: [
    { id: "a", properties: { mag: 5.2, title: "M 5.2 - X", time: 1727220000000, url: "https://example.invalid/a", status: "reviewed" }, geometry: { coordinates: [10, 20, 33] } },
    { id: "b", properties: { mag: null, place: "Y" }, geometry: { coordinates: [0, 0, 0] } },
    { id: "bad", properties: {}, geometry: { coordinates: ["x", 1] } },
  ] });
  assert.equal(out.length, 2);
  assert.equal(out[0].status, "reviewed");
  assert.equal(out[0].depthKm, 33);
  assert.equal(out[0].src, "usgs");
  assert.equal(out[1].status, "preliminary");
  assert.throws(() => normalizeQuakes({}), /FEED_INVALID/);
});
test("quakes URL carries filters", () => {
  assert.ok(quakesUrl({ minMag: 6, limit: 10 }).includes("minmagnitude=6"));
});
test("quakes live fetch maps through fetcher seam", async () => {
  const rows = await fetchQuakes({ fetchJson: async () => ({ body: { features: [{ id: "q", properties: { mag: 6 }, geometry: { coordinates: [1, 2, 3] } }] } }) });
  assert.equal(rows.length, 1);
  await assert.rejects(() => fetchQuakes({ fetchJson: async () => { throw Object.assign(new Error("FEED_OFFLINE"), { code: "FEED_OFFLINE" }); } }), /FEED_OFFLINE/);
});
test("eonet keeps wanted point categories, drops polygons", () => {
  const out = normalizeEvents({ events: [
    { id: "E1", title: "Fire", categories: [{ id: "wildfires" }], geometry: [{ date: "2026-09-20T00:00:00Z", coordinates: [30, -110] }], sources: [{ url: "https://example.invalid/s" }] },
    { id: "E2", title: "Sea ice", categories: [{ id: "seaIce" }], geometry: [{ coordinates: [0, 70] }] },
    { id: "E3", title: "Poly", categories: [{ id: "wildfires" }], geometry: [{ coordinates: [[[0, 0], [1, 1]]] }] },
  ] });
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].categories, ["wildfires"]);
  assert.equal(out[0].src, "eonet");
  assert.throws(() => normalizeEvents(null), /FEED_INVALID/);
});
test("eonet live fetch maps through fetcher seam", async () => {
  const rows = await fetchEvents({ fetchJson: async () => ({ body: { events: [{ id: "E", categories: [{ id: "volcanoes" }], geometry: [{ coordinates: [1, 2] }] }] } }) });
  assert.equal(rows.length, 1);
});
