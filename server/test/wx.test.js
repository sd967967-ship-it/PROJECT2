const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeWx, validatePoint, fetchWx } = require("../src/geo/wx");

test("wx validates point ranges", () => {
  assert.deepEqual(validatePoint("28.6", "77.2"), { lat: 28.6, lon: 77.2 });
  for (const [la, lo] of [["x", 0], [91, 0], [0, 181], [null, 0], [0, ""], [null, null]]) {
    assert.throws(() => validatePoint(la, lo), /bad lat\/lon/);
  }
});
test("wx normalizes forecast + AQI with WMO summary", () => {
  const d = normalizeWx(
    { current: { temperature_2m: 31, apparent_temperature: 33, relative_humidity_2m: 60, precipitation: 0, weather_code: 2, wind_speed_10m: 12, wind_direction_10m: 270, time: "2026-09-27T10:00" } },
    { current: { us_aqi: 88, pm2_5: 30 } }, "metric");
  assert.equal(d.summary, "Partly cloudy");
  assert.equal(d.aqi, 88);
  assert.equal(d.units, "metric");
  assert.equal(d.src, "open-meteo");
  const u = normalizeWx({ current: {} }, null, "imperial");
  assert.equal(u.summary, null);
  assert.equal(u.aqi, null);
});
test("wx caches per point and tolerates AQI outage", async () => {
  let calls = 0;
  const fx = async (url) => {
    calls++;
    if (url.includes("air-quality")) throw new Error("aqi down");
    return { body: { current: { temperature_2m: 20, weather_code: 0, time: "t" } } };
  };
  const a = await fetchWx({ fetchJson: fx, lat: 10, lon: 20 });
  assert.equal(a.aqi, null);
  assert.equal(a.cached, false);
  const b = await fetchWx({ fetchJson: fx, lat: 10, lon: 20 });
  assert.equal(b.cached, true);
  assert.equal(calls, 2); // forecast + failed AQI, then cache hit
});
