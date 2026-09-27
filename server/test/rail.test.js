const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseTrainsXml, normalizeTrains, toMovers: ieMovers, fetchLive: ieLive } = require("../src/streets/irishrail");
const { normalizeTrains: fiNorm, toMovers: fiMovers, fetchLive: fiLive } = require("../src/streets/finrail");

const IE_XML = `<?xml version="1.0" encoding="utf-8"?>
<ArrayOfObjTrainPositions xmlns="http://api.irishrail.ie/realtime/">
<objTrainPositions><TrainStatus>R</TrainStatus><TrainLatitude>53.35</TrainLatitude><TrainLongitude>-6.26</TrainLongitude><TrainCode>DART1</TrainCode><PublicMessage>Dublin Connolly to Bray</PublicMessage><Direction>Southbound</Direction><TrainOrigin>Dublin Connolly</TrainOrigin><TrainDestination>Bray</TrainDestination></objTrainPositions>
<objTrainPositions><TrainStatus>R</TrainStatus><TrainLatitude>bad</TrainLatitude><TrainLongitude>-6.0</TrainLongitude><TrainCode>X2</TrainCode></objTrainPositions>
</ArrayOfObjTrainPositions>`;
test("irish rail parses XML positions, drops bad coords", () => {
  const out = parseTrainsXml(IE_XML);
  assert.equal(out.length, 1);
  assert.equal(out[0].code, "DART1");
  assert.equal(out[0].dest, "Bray");
  assert.equal(out[0].src, "irishrail");
  assert.throws(() => parseTrainsXml("not xml <"), /FEED_INVALID/);
  assert.throws(() => parseTrainsXml("<ok>no trains here</ok>"), /FEED_INVALID/);
});
test("irish rail movers carry rail system + IE flag", () => {
  const m = ieMovers([{ code: "D1", lat: 1, lon: 2, dest: "Cork", status: "R", src: "irishrail" }], "live");
  assert.equal(m[0].id, "ie-D1");
  assert.equal(m[0].meta.system, "rail");
  assert.equal(m[0].meta.country, "IE");
  assert.equal(m[0].domain, "streets");
});
test("irish rail live fetch maps through fetcher seam", async () => {
  const rows = await ieLive({ fetchTextFn: async () => IE_XML });
  assert.equal(rows.length, 1);
  await assert.rejects(() => ieLive({ fetchTextFn: async () => { throw Object.assign(new Error("FEED_OFFLINE"), { code: "FEED_OFFLINE" }); } }), /FEED_OFFLINE/);
});
test("digitraffic normalizes GeoJSON train locations", () => {
  const out = fiNorm([
    { trainNumber: 5, departureDate: "2026-09-27", speed: 10, timestamp: "2026-09-27T14:09:54.000Z", isGpsLocation: true, location: { type: "Point", coordinates: [29.9, 62.03] } },
    { trainNumber: null, location: { coordinates: [1, 2] } },
    { trainNumber: 7, location: null },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].lat, 62.03);
  assert.equal(out[0].lon, 29.9);
  assert.equal(out[0].kmh, 36);
  assert.equal(out[0].src, "digitraffic");
});
test("digitraffic movers carry rail system + FI flag", () => {
  const m = fiMovers([{ number: 5, date: "2026-09-27", lat: 1, lon: 2, kmh: 36, src: "digitraffic" }], "live");
  assert.equal(m[0].id, "fi-5-2026-09-27");
  assert.equal(m[0].label, "Train 5");
  assert.equal(m[0].meta.system, "rail");
  assert.equal(m[0].meta.country, "FI");
});
test("digitraffic live fetch maps through fetcher seam", async () => {
  const rows = await fiLive({ fetchJson: async () => ({ body: [{ trainNumber: 1, location: { coordinates: [1, 2] } }] }) });
  assert.equal(rows.length, 1);
});
