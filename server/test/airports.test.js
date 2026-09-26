const { test } = require("node:test");
const assert = require("node:assert/strict");
const { build } = require("../src/index");

test("GET /api/airports returns hubs with nearby counts", async () => {
  const app = build();
  const srv = await new Promise((res) => { const s = app.listen(0, () => res(s)); });
  try {
    const r = await fetch(`http://127.0.0.1:${srv.address().port}/api/airports`);
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.ok(Array.isArray(body.airports) && body.airports.length >= 20);
    const del = body.airports.find((a) => a.iata === "DEL");
    assert.ok(del && typeof del.nearby === "number" && del.lat && del.lon);
  } finally { srv.close(); }
});
