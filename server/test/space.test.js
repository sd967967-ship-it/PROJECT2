const { test } = require("node:test");
const assert = require("node:assert/strict");
const sat = require("satellite.js");
const { parseTle, demoSets, tleDetails, propagateToMovers, createTleStore, TLE_URLS } = require("../src/space/tle");
const { getSolarBodies } = require("../src/space/solar");
const { CRAFT, toMovers } = require("../src/space/craft");

const ISS_L1 = "1 25544U 98067A   26270.17419514  .00009528  00000+0  18291-3 0  9996";
const ISS_L2 = "2 25544  51.6315 155.3455 0007168 193.0559 167.0244 15.48664528587569";
test("tle default groups cover LEO plus the far belt", () => {
  for (const g of ["stations", "visual", "geo", "gps-ops", "galileo", "glo-ops", "goes"]) {
    assert.ok(TLE_URLS.some((u) => u.includes(`GROUP=${g}`)), `missing ${g}`);
  }
});
test("tle parses 3-line sets, skips garbage", () => {
  const sets = parseTle(`ISS (ZARYA)\n${ISS_L1}\n${ISS_L2}\njunk line\nCSS (TIANHE)\n1 48274U 21035A   26269.87524669  .00012403  00000+0  15118-3 0  9996\n2 48274  41.4683  64.5157 0001914 314.1424  45.9257 15.60301806309043\n`);
  assert.equal(sets.length, 2);
  assert.equal(sets[0].noradId, "25544");
  assert.deepEqual(parseTle("nothing here\n"), []);
  assert.ok(demoSets().length >= 3);
});
test("tle propagates to plausible LEO movers", () => {
  const m = propagateToMovers(demoSets(), new Date(), sat, "demo");
  assert.ok(m.length >= 3);
  const iss = m.find((s) => s.id === "sat-25544");
  assert.ok(iss, "ISS present");
  assert.ok(Math.abs(iss.meta.inclDeg - 51.63) < 0.2, `incl ${iss.meta.inclDeg}`);
  assert.ok(Math.abs(iss.meta.periodMin - 93.0) < 0.6, `period ${iss.meta.periodMin}`);
  assert.equal(iss.meta.launchYear, 1998);
  assert.ok(iss.meta.perigeeKm > 350 && iss.meta.apogeeKm < 500, `apsides ${iss.meta.perigeeKm}/${iss.meta.apogeeKm}`);
  for (const s of m) {
    assert.ok(Math.abs(s.lat) <= 90 && Math.abs(s.lon) <= 180);
    assert.ok(s.altM > 100000 && s.altM < 2000000, `alt ${s.altM}`);
    assert.ok(s.velKmh > 20000 && s.velKmh < 35000, `vel ${s.velKmh}`);
    assert.equal(s.domain, "space");
    assert.equal(s.kind, "satellite");
  }
});
test("tle store serves demo at boot, goes live on refresh", async () => {
  const store = createTleStore({ fetchSetsFn: async () => [{ name: "X", noradId: "1", l1: ISS_L1, l2: ISS_L2 }] });
  assert.equal(store.src(), "demo");
  await store.refresh();
  assert.equal(store.src(), "live");
  const dead = createTleStore({ fetchSetsFn: async () => { throw new Error("x"); } });
  await dead.refresh();
  assert.equal(dead.src(), "demo");
  assert.ok(dead.sets().length >= 3);
});
test("solar subpoints are sane", () => {
  const bodies = getSolarBodies(new Date("2026-09-27T12:00:00Z"));
  assert.ok(bodies.length >= 15);
  const sun = bodies.find((b) => b.id === "solar-sun");
  assert.ok(Math.abs(sun.lat) <= 23.6, `subsolar lat ${sun.lat}`);
  assert.ok(Math.abs(sun.lon) <= 180);
  assert.ok(sun.meta.distKm > 146e6 && sun.meta.distKm < 152e6);
  const moon = bodies.find((b) => b.id === "solar-moon");
  assert.ok(moon.meta.distKm > 350000 && moon.meta.distKm < 410000, `moon ${moon.meta.distKm}`);
  assert.ok(moon.meta.illum >= 0 && moon.meta.illum <= 1);
  const pluto = bodies.find((b) => b.id === "solar-pluto");
  assert.ok(pluto.meta.distKm > 29 * 149597870 && pluto.meta.distKm < 50 * 149597870, `pluto ${pluto.meta.distKm}`);
  const titan = bodies.find((b) => b.id === "solar-titan");
  assert.equal(titan.meta.parent, "Saturn");
  assert.equal(titan.meta.orbitKm, 1221870);
  const io = bodies.find((b) => b.id === "solar-io");
  assert.equal(io.meta.parent, "Jupiter");
  for (const b of bodies) {
    assert.ok(Number.isFinite(b.lat) && Number.isFinite(b.lon) && b.meta.distKm > 0, b.id);
    assert.equal(b.domain, "space");
    assert.equal(b.kind, "solar");
  }
});
test("craft dataset anchors vicinity movers on target bodies", () => {
  assert.ok(CRAFT.length >= 12);
  assert.ok(CRAFT.every((c) => c.id && c.name && c.agency && c.target && c.anchor && c.mission && c.launchYear && c.status));
  const bodies = getSolarBodies(new Date());
  const byId = {};
  for (const b of bodies) byId[b.id] = b;
  const movers = toMovers(CRAFT, byId);
  assert.equal(movers.length, CRAFT.length);
  for (const m of movers) {
    assert.equal(m.domain, "space");
    assert.equal(m.kind, "craft");
    assert.ok(Math.abs(m.lat) <= 90 && Math.abs(m.lon) <= 180);
    assert.ok(m.meta.vicinity && m.meta.agency && m.meta.target);
  }
  const lro = movers.find((m) => m.id === "craft-lro");
  const moon = byId["solar-moon"];
  assert.ok(Math.abs(lro.lat - moon.lat) < 5 && Math.abs(lro.lon - moon.lon) < 5);
});
