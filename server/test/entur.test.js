const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeDepartures, bboxFor, fetchBoard } = require("../src/streets/entur");

test("entur normalizes departures with realtime flags", () => {
  const out = normalizeDepartures([
    { aimedDepartureTime: "2026-09-27T15:24:00+02:00", expectedDepartureTime: "2026-09-27T15:29:58+02:00", realtime: true, destinationDisplay: { frontText: "Nydalen" }, serviceJourney: { line: { publicCode: "30", transportMode: "bus" } } },
    { aimedDepartureTime: "2026-09-27T15:31:00+02:00", expectedDepartureTime: "2026-09-27T15:31:00+02:00", realtime: false, destinationDisplay: { frontText: "X" }, serviceJourney: { line: { publicCode: "1", transportMode: "metro" } } },
    { aimedDepartureTime: null, destinationDisplay: { frontText: "Y" } },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].delayMin, 6);
  assert.equal(out[0].realtime, true);
  assert.equal(out[1].realtime, false);
});
test("entur bbox spans the requested radius", () => {
  const b = bboxFor(59.91, 10.75, 2);
  assert.ok(b.minLat < 59.91 && b.maxLat > 59.91 && b.minLon < 10.75 && b.maxLon > 10.75);
  assert.ok((b.maxLat - b.minLat) * 111.32 > 3.5);
});
test("entur board resolves stop then departures, caches, validates", async () => {
  let calls = 0;
  const fetchJson = async (url, opts) => {
    calls++;
    const q = opts.json.query;
    if (q.includes("stopPlacesByBbox")) return { body: { data: { stopPlacesByBbox: [{ id: "NSR:1", name: "Test" }] } } };
    return { body: { data: { stopPlace: { name: "Test", estimatedCalls: [{ aimedDepartureTime: "2026-09-27T15:24:00+02:00", expectedDepartureTime: "2026-09-27T15:24:00+02:00", realtime: true, destinationDisplay: { frontText: "D" }, serviceJourney: { line: { publicCode: "5", transportMode: "bus" } } }] } } } };
  };
  const a = await fetchBoard({ fetchJson, lat: 59.91, lon: 10.75 });
  assert.equal(a.stop.name, "Test");
  assert.equal(a.departures.length, 1);
  assert.equal(a.cached, false);
  await fetchBoard({ fetchJson, lat: 59.91, lon: 10.75 });
  assert.equal(calls, 3); // stops + calls, then cache hit (no new calls)
  const empty = await fetchBoard({ fetchJson: async () => ({ body: { data: { stopPlacesByBbox: [] } } }), lat: 0, lon: 0 });
  assert.equal(empty.stop, null);
  assert.ok(/Norway/.test(empty.note));
  await assert.rejects(() => fetchBoard({ fetchJson, lat: 999, lon: 0 }), /bad lat\/lon/);
});
