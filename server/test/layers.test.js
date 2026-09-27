const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildLayers, snapshotState } = require("../src/status");
const { build } = require("../src/index");

test("feed pollers honor the states[] contract (singletons wrapped)", async () => {
  const { feeds } = require("../src/index");
  for (const [name, p] of Object.entries(feeds)) {
    const rows = await p.fetchPrimary().catch(() => null);
    if (rows) assert.ok(Array.isArray(rows), `${name} must yield states[]`);
  }
});
test("status maps snapshots to layer states honestly", () => {
  assert.equal(snapshotState("live", [{ src: "x" }], Date.now(), 60000).state, "live");
  assert.equal(snapshotState("fallback", [{ src: "demo" }], Date.now(), 60000).state, "unavailable");
  assert.equal(snapshotState("fallback", [{ src: "ais" }], Date.now(), 60000).state, "live");
  assert.equal(snapshotState("none", [], 0, 60000).state, "unavailable");
  const layers = buildLayers([
    { id: "a", category: "C", label: "A", kind: "static" },
    { id: "b", category: "C", label: "B", kind: "snapshot", cadenceMs: 60000, get: () => ({ src: "live", t: Date.now(), states: [{ src: "x" }] }) },
    { id: "c", category: "C", label: "C", kind: "snapshot", cadenceMs: 60000, parked: true, parkedNote: "needs key", get: () => { throw new Error("unused"); } },
    { id: "d", category: "C", label: "D", kind: "computed" },
    { id: "e", category: "C", label: "E", kind: "ondemand", last: () => null },
  ]);
  assert.deepEqual(layers.map((l) => l.state), ["static", "live", "unavailable", "live", "unavailable"]);
});
test("GET /api/layers lists every layer with status", async () => {
  const app = build();
  const srv = await new Promise((res) => { const s = app.listen(0, () => res(s)); });
  try {
    const base = `http://127.0.0.1:${srv.address().port}`;
    const body = await (await fetch(`${base}/api/layers`)).json();
    const ids = body.layers.map((l) => l.id);
    for (const id of ["flights", "vessels", "satellites", "airports", "quakes", "events", "terminator", "weather", "aurora", "fireballs"]) {
      assert.ok(ids.includes(id), `missing ${id}`);
    }
    for (const l of body.layers) {
      assert.ok(["live", "delayed", "cached", "static", "unavailable"].includes(l.state), `${l.id}:${l.state}`);
      assert.ok(l.category && l.label);
    }
    const q = body.layers.find((l) => l.id === "quakes");
    assert.equal(q.state, "unavailable"); // empty cache at boot reads unavailable, never live
  } finally { srv.close(); }
});
test("hazard + weather + space-weather endpoints validate input", async () => {
  const app = build();
  const srv = await new Promise((res) => { const s = app.listen(0, () => res(s)); });
  try {
    const base = `http://127.0.0.1:${srv.address().port}`;
    assert.equal((await fetch(`${base}/api/hazards/quakes?minMag=99`)).status, 400);
    assert.equal((await fetch(`${base}/api/hazards/quakes?minMag=0`)).status, 400); // cache floor is M4.5
    const q = await (await fetch(`${base}/api/hazards/quakes`)).json();
    assert.ok(Array.isArray(q.quakes));
    assert.equal((await fetch(`${base}/api/weather?lat=999&lon=0`)).status, 400);
    assert.equal((await fetch(`${base}/api/weather`)).status, 400);
    const bad = await fetch(`${base}/api/space/solar?date=nope`);
    assert.equal(bad.status, 400);
    const ports = await (await fetch(`${base}/api/sea/ports`)).json();
    assert.ok(ports.count >= 60);
    const sw = await (await fetch(`${base}/api/space/weather`)).json();
    assert.ok("kp" in sw && Array.isArray(sw.fireballs));
    const emptyBoard = await (await fetch(`${base}/api/streets/board?lat=0&lon=0`)).json();
    assert.equal(emptyBoard.stop, null);
    assert.ok(/Norway/.test(emptyBoard.note));
    assert.equal(emptyBoard.src, "entur");
    assert.equal((await fetch(`${base}/api/streets/board?lat=999&lon=0`)).status, 400);
    const solar = await (await fetch(`${base}/api/space/solar?date=2026-01-01`)).json();
    assert.ok(solar.count >= 15 && solar.date.startsWith("2026-01-01"));
    assert.ok(Array.isArray(solar.earthHelio) && solar.earthHelio.length === 3);
  } finally { srv.close(); }
});
