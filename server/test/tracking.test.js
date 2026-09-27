const { test } = require("node:test");
const assert = require("node:assert/strict");
const { DOMAINS, assertDomain, deriveSrc, createRegistry } = require("../src/tracking/source");
const { build } = require("../src/index");

test("registry lists four domains with labels", () => {
  const r = createRegistry({
    sky: { getSnapshot: () => ({ t: 1, src: "demo", movers: [] }) },
    sea: { getSnapshot: () => ({ t: 1, src: "demo", movers: [] }) },
    streets: { getSnapshot: () => ({ t: 1, src: "demo", movers: [] }) },
    space: { getSnapshot: () => ({ t: 1, src: "demo", movers: [] }) },
  });
  assert.deepEqual(r.domains().map((d) => d.id), ["sky", "sea", "streets", "space"]);
  assert.ok(r.domains().every((d) => d.label && d.credit));
});
test("registry rejects unknown domains and missing sources", () => {
  const r = createRegistry({
    sky: { getSnapshot: () => ({ t: 1, src: "demo", movers: [{ id: "a", lat: 1, lon: 1 }] }) },
    sea: { getSnapshot: () => ({ t: 1, src: "demo", movers: [] }) },
    streets: { getSnapshot: () => ({ t: 1, src: "demo", movers: [] }) },
    space: { getSnapshot: () => ({ t: 1, src: "demo", movers: [] }) },
  });
  assert.throws(() => r.getSnapshot("ocean"), /unknown domain/);
  assert.throws(() => createRegistry({ sky: { getSnapshot: () => ({}) } }), /missing/);
  assert.deepEqual(DOMAINS, ["sky", "sea", "streets", "space"]);
  assert.throws(() => assertDomain("air"), /unknown domain/);
});
test("registry culls to bbox", () => {
  const r = createRegistry({
    sky: { getSnapshot: () => ({ t: 1, src: "demo", movers: [{ id: "a", lat: 1, lon: 1 }, { id: "b", lat: 50, lon: 50 }] }) },
    sea: { getSnapshot: () => ({ t: 1, src: "demo", movers: [] }) },
    streets: { getSnapshot: () => ({ t: 1, src: "demo", movers: [] }) },
    space: { getSnapshot: () => ({ t: 1, src: "demo", movers: [] }) },
  });
  const s = r.getSnapshot("sky", { lamin: 0, lomin: 0, lamax: 10, lomax: 10 });
  assert.deepEqual(s.movers.map((m) => m.id), ["a"]);
});
test("deriveSrc maps poller states to display source", () => {
  assert.equal(deriveSrc("live", [{ src: "x" }]), "live");
  assert.equal(deriveSrc("none", []), "demo");
  assert.equal(deriveSrc("fallback", [{ src: "demo" }]), "demo");
  assert.equal(deriveSrc("fallback", [{ src: "ais" }]), "fallback");
  assert.equal(deriveSrc("none", [{ src: "ais" }]), "none");
});
test("GET /api/domains + per-domain snapshots serve demo at boot", async () => {
  const app = build();
  const srv = await new Promise((res) => { const s = app.listen(0, () => res(s)); });
  try {
    const base = `http://127.0.0.1:${srv.address().port}`;
    const d = await (await fetch(`${base}/api/domains`)).json();
    assert.deepEqual(d.domains.map((x) => x.id), ["sky", "sea", "streets", "space"]);
    for (const dom of ["sea", "streets", "space"]) {
      const s = await (await fetch(`${base}/api/${dom}/snapshot`)).json();
      assert.ok(s.count > 0 && Array.isArray(s.movers), dom);
      assert.ok(["demo", "live", "fallback"].includes(s.src), dom);
      assert.ok(s.movers.every((m) => m.id && Number.isFinite(m.lat) && Number.isFinite(m.lon) && m.domain === dom), dom);
    }
    const sky = await (await fetch(`${base}/api/sky/snapshot`)).json();
    assert.ok(Array.isArray(sky.tracks));
    const bad = await fetch(`${base}/api/ocean/snapshot`);
    assert.equal(bad.status, 404);
  } finally { srv.close(); }
});
test("detail + stops + solar endpoints answer", async () => {
  const app = build();
  const srv = await new Promise((res) => { const s = app.listen(0, () => res(s)); });
  try {
    const base = `http://127.0.0.1:${srv.address().port}`;
    const sea = await (await fetch(`${base}/api/sea/snapshot`)).json();
    const v = await (await fetch(`${base}/api/sea/vessels/${sea.movers[0].id}`)).json();
    assert.ok(v.vessel && v.vessel.label);
    assert.equal((await fetch(`${base}/api/sea/vessels/nope`)).status, 404);
    const st = await (await fetch(`${base}/api/streets/snapshot`)).json();
    const vh = await (await fetch(`${base}/api/streets/vehicles/${st.movers[0].id}`)).json();
    assert.ok(vh.vehicle && vh.vehicle.label);
    const stops = await (await fetch(`${base}/api/streets/stops`)).json();
    assert.ok(stops.stops.length >= 10);
    const sp = await (await fetch(`${base}/api/space/snapshot`)).json();
    const o = await (await fetch(`${base}/api/space/objects/${encodeURIComponent(sp.movers[0].id)}`)).json();
    assert.ok(o.object && o.object.label);
    const solar = await (await fetch(`${base}/api/space/solar`)).json();
    assert.ok(solar.count >= 9 && solar.bodies.some((b) => b.id === "solar-sun"));
  } finally { srv.close(); }
});
