// SkyTrack 3D globe. Same-origin /api + ws only. Shared dossier logic lives in shared.js.
const state = { viewer: null, entities: new Map(), routeEnt: null, trailEnt: null, mode: "demo", domain: "sky", ws: null, all: [], imagery: {}, airports: [], solar: { active: false, entities: new Map(), earthHelio: null }, selectedHex: null, followHex: null, trails: new Map() };
const REDUCED = (() => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } })();
function flyDur(s) { return REDUCED ? 0 : s; }
function pushTrail(f) {
  if (!f || f.hex == null) return;
  let t = state.trails.get(f.hex);
  if (!t) { t = []; state.trails.set(f.hex, t); }
  const last = t[t.length - 1];
  if (!last || Math.abs(last[0] - f.lat) > 1e-4 || Math.abs(last[1] - f.lon) > 1e-4) t.push([f.lat, f.lon]);
  if (t.length > 12) t.shift();
  if (state.trails.size > 1200) state.trails.delete(state.trails.keys().next().value);
}

function drawPlane(g, hdgDeg) {
  // Top-down silhouette pointing north, rotated to the true heading.
  const hdg = ((Number(hdgDeg) || 0) % 360 + 360) % 360;
  g.save();
  g.translate(36, 36);
  g.rotate(hdg * Math.PI / 180);
  g.beginPath();
  g.moveTo(0, -26);            // nose
  g.lineTo(5, -8);             // fuselage right
  g.lineTo(26, 4);             // right wing tip
  g.lineTo(26, 9);
  g.lineTo(5, 4);
  g.lineTo(4, 18);             // tail right
  g.lineTo(12, 22);            // right tailplane
  g.lineTo(12, 25);
  g.lineTo(0, 22);
  g.lineTo(-12, 25);
  g.lineTo(-12, 22);
  g.lineTo(-4, 18);
  g.lineTo(-5, 4);
  g.lineTo(-26, 9);
  g.lineTo(-26, 4);
  g.lineTo(-5, -8);
  g.closePath();
  g.fillStyle = "#ffd23f";
  g.strokeStyle = "#0b2036"; g.lineWidth = 3;
  g.fill(); g.stroke();
  g.restore();
}
function planeBillboard(hdg) {
  const c = document.createElement("canvas"); c.width = c.height = 72;
  drawPlane(c.getContext("2d"), hdg);
  return c.toDataURL();
}
// Per-kind markers: planes keep the silhouette; other domains get compact
// color-coded glyphs so the mode is readable at a glance.
function glyphBillboard(kind, color, hdg) {
  const c = document.createElement("canvas"); c.width = c.height = 72;
  const g = c.getContext("2d");
  g.strokeStyle = "#0b2036"; g.lineWidth = 3;
  if (kind === "vessel") {
    const h = ((Number(hdg) || 0) % 360 + 360) % 360;
    g.save(); g.translate(36, 36); g.rotate(h * Math.PI / 180);
    g.beginPath(); g.moveTo(0, -26); g.lineTo(10, 10); g.lineTo(6, 24); g.lineTo(-6, 24); g.lineTo(-10, 10); g.closePath();
    g.fillStyle = color; g.fill(); g.stroke();
    g.beginPath(); g.moveTo(0, -26); g.lineTo(0, -6); g.stroke();
    g.restore();
  } else if (kind === "vehicle") {
    g.fillStyle = color;
    g.beginPath(); g.roundRect(18, 14, 36, 44, 8); g.fill(); g.stroke();
    g.fillStyle = "#0b2036"; g.fillRect(23, 20, 26, 12);
    g.beginPath(); g.arc(26, 62, 3, 0, Math.PI * 2); g.arc(46, 62, 3, 0, Math.PI * 2); g.fill();
  } else if (kind === "satellite") {
    g.fillStyle = color;
    g.save(); g.translate(36, 36); g.rotate(Math.PI / 4); g.fillRect(-9, -9, 18, 18); g.restore(); g.strokeRect(27, 27, 18, 18);
    g.fillRect(10, 32, 14, 8); g.fillRect(48, 32, 14, 8);
  } else if (kind === "craft") {
    g.strokeStyle = color; g.lineWidth = 3;
    g.beginPath(); g.moveTo(36, 12); g.lineTo(36, 60); g.moveTo(12, 36); g.lineTo(60, 36); g.stroke();
    g.fillStyle = color;
    g.save(); g.translate(36, 36); g.rotate(Math.PI / 4); g.fillRect(-7, -7, 14, 14); g.restore();
  } else { // solar body: glowing disc
    g.fillStyle = color;
    g.beginPath(); g.arc(36, 36, 16, 0, Math.PI * 2); g.fill(); g.stroke();
    g.strokeStyle = color; g.lineWidth = 2;
    g.beginPath(); g.arc(36, 36, 24, 0, Math.PI * 2); g.stroke();
  }
  return c.toDataURL();
}
function iconFor(f) {
  const k = f.kind || "flight";
  if (k === "flight") return planeBillboard(f.hdg);
  if (k === "craft" || k === "satellite" || k === "vessel" || k === "vehicle" || k === "solar") return glyphBillboard(k, (DOMAINS[state.domain] || DOMAINS.sky).color, f.hdg);
  return glyphBillboard("solar", (DOMAINS[state.domain] || DOMAINS.sky).color, f.hdg);
}
function snapshotUrl() { return state.domain === "sky" ? "/api/snapshot" : `/api/${state.domain}/snapshot`; }
function detailUrlFor(id) { return DOMAINS[state.domain].detail(id); }
function sendSub() {
  try { if (state.ws && state.ws.readyState === 1) state.ws.send(JSON.stringify({ op: "sub", domain: state.domain })); } catch { /* reconnect covers */ }
}
function setDomain(d) {
  if (!DOMAINS[d] || d === state.domain) return;
  if (state.domain === "space") exitSolarSystem();
  state.domain = d;
  document.querySelectorAll(".modes button").forEach((b) => {
    const on = b.dataset.domain === d;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  for (const [, e] of state.entities) state.viewer.entities.remove(e);
  state.entities.clear();
  state.selectedHex = null; state.followHex = null; state.tourIdx = null;
  applyAirports();
  const tour = document.getElementById("tour");
  if (tour) tour.hidden = d !== "space";
  const solarBlock = document.getElementById("solarBlock");
  if (solarBlock) solarBlock.hidden = d !== "space";
  const systemBlock = document.getElementById("systemBlock");
  if (systemBlock) systemBlock.hidden = d !== "streets";
  resetDossier(d);
  announce(`${DOMAINS[d].label} mode`);
  sendSub();
  live();
}
function wireModes() {
  document.querySelectorAll(".modes button").forEach((b) => b.addEventListener("click", () => setDomain(b.dataset.domain)));
}
// Solar-system scene (Space mode): heliocentric view on the main page. The Sun
// sits at the origin, planets/moons ride scaled true positions, orbit guides
// mark the paths, and the live TLE belt wraps an Earth marker. Positions are
// true; sizes exaggerated and labeled. One viewer, no new libraries.
const AU_SCENE = 1e6; // scene meters per AU (Neptune ~3e7 m: proven render range)
const SAT_EX = 40; // TLE cloud exaggerated around the Earth marker, labeled
const PLANET_STYLE = {
  sun: ["#ffb454", 64], moon: ["#cfd6e4", 24], mercury: ["#9c8e82", 20], venus: ["#e8c47a", 26],
  earth: ["#57a6ff", 28], mars: ["#e07a4f", 24], jupiter: ["#d8b48f", 40], saturn: ["#e3cf9e", 38],
  uranus: ["#9fe3e8", 30], neptune: ["#5f7ff2", 30], pluto: ["#c9b8a8", 18],
};
function helioScene(h) { return new Cesium.Cartesian3(h[0] * AU_SCENE, h[2] * AU_SCENE, -h[1] * AU_SCENE); }
function discBillboard(color, glow) {
  const c = document.createElement("canvas"); c.width = c.height = 72;
  const g = c.getContext("2d");
  g.fillStyle = color;
  g.beginPath(); g.arc(36, 36, glow ? 20 : 15, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#0b2036"; g.lineWidth = 3; g.stroke();
  if (glow) { g.strokeStyle = color; g.lineWidth = 2; g.beginPath(); g.arc(36, 36, 28, 0, Math.PI * 2); g.stroke(); }
  return c.toDataURL();
}
function solarAdd(id, pos, img, px, track, labelText, labelFar) {
  const v = state.viewer;
  let e = state.solar.entities.get(id);
  if (!e) {
    const parts = { id, position: pos, billboard: { image: img, width: px, height: px } };
    if (labelText) parts.label = { text: labelText, font: "13px 'IBM Plex Mono', monospace", fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(0, -30), distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, labelFar || 5e8) };
    e = v.entities.add(parts);
    state.solar.entities.set(id, e);
  } else e.position = pos;
  e.track = track || null; e._scenePos = pos;
  return e;
}
function bodyStyle(f) {
  if (f.kind === "craft") return ["#ffd23f", 20];
  if (f.kind === "satellite") return ["#c9a7ff", 12];
  const key = String((f.meta && f.meta.body) || f.label || "").toLowerCase();
  if (key === "sun") return PLANET_STYLE.sun;
  if (PLANET_STYLE[key]) return PLANET_STYLE[key];
  if (f.meta && f.meta.parent) return ["#d7def0", 16]; // major moons
  return ["#c9a7ff", 20];
}
function enterSolarSystem() {
  const v = state.viewer;
  exitSolarSystem(false);
  v.scene.globe.show = false;
  v.scene.skyAtmosphere.show = false; // atmosphere renders a white disc with no globe behind it
  for (const [, e] of state.entities) e.show = false; // globe markers stay out of the scene
  if (state.trailEnt) state.trailEnt.show = false;
  if (state.routeEnt) state.routeEnt.show = false;
  v.trackedEntity = undefined;
  state.solar.active = true;
  updateSolarSystem(state.all);
  try { v.camera.flyTo({ destination: new Cesium.Cartesian3(0, 2.2e7, 3.2e7), duration: flyDur() }); } catch { /* globe not ready */ }
  v.scene.requestRender();
}
function exitSolarSystem(restoreView = true) {
  const v = state.viewer;
  if (!v) return;
  for (const [, e] of state.solar.entities) v.entities.remove(e);
  state.solar.entities.clear();
  state.solar.active = false;
  v.scene.globe.show = true;
  v.scene.skyAtmosphere.show = true;
  for (const [, e] of state.entities) e.show = true;
  if (state.trailEnt) state.trailEnt.show = true;
  if (state.routeEnt) state.routeEnt.show = true;
  if (restoreView) { try { v.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(60, 25, 16000000), duration: flyDur() }); } catch { /* globe not ready */ } }
}
function updateSolarBodies(bodies, seen) {
  const v = state.viewer, byId = {};
  const parentHelio = {};
  for (const b of bodies) {
    if (b.kind === "solar" && b.helio && !(b.meta && b.meta.parent) && b.meta && b.meta.body) {
      parentHelio[b.meta.body.toLowerCase()] = b.helio;
    }
  }
  for (const b of bodies) {
    if (b.kind !== "solar" || !b.helio) continue;
    const [color, px] = bodyStyle(b);
    // Moon labels only join at closer range so the inner-system pile stays readable.
    const far = b.meta && b.meta.parent ? 8e6 : 5e8;
    // Major moons ride exaggerated parent-relative offsets: true offsets sit
    // inside the planet marker even on tour, so ×30 keeps them findable.
    let hel = b.helio;
    const ph = b.meta && b.meta.parent && parentHelio[b.meta.parent.toLowerCase()];
    if (ph) hel = [ph[0] + (hel[0] - ph[0]) * 30, ph[1] + (hel[1] - ph[1]) * 30, ph[2] + (hel[2] - ph[2]) * 30];
    const pos = helioScene(hel);
    byId[b.id] = pos;
    solarAdd(`sol-${b.id}`, pos, discBillboard(color, b.id === "solar-sun"), px, b, b.label, far);
    seen.add(`sol-${b.id}`);
    if (b.semiMajorAu) {
      const pts = [];
      for (let i = 0; i <= 72; i++) { const a = (i / 72) * Math.PI * 2; pts.push(helioScene([Math.cos(a) * b.semiMajorAu, Math.sin(a) * b.semiMajorAu, 0])); }
      const rid = `sol-ring-${b.id}`;
      seen.add(rid);
      if (!state.solar.entities.get(rid)) state.solar.entities.set(rid, v.entities.add({ id: rid, polyline: { positions: pts, width: 1, material: Cesium.Color.fromCssColorString("#3a5aa8").withAlpha(0.55) } }));
    }
  }
  state.solar.bodies = bodies;
  buildSolarTable(bodies);
  return byId;
}
function buildSolarTable(bodies) {
  const tb = document.getElementById("solarRows");
  if (!tb) return;
  tb.innerHTML = (bodies || []).filter((b) => b.kind === "solar").map((b) => {
    const m = b.meta || {};
    const dist = m.distAu != null && m.distAu >= 0.01 ? `${m.distAu} AU` : (m.distKm != null ? `${m.distKm.toLocaleString()} km` : "–");
    const notes = [m.parent && `orbits ${esc(m.parent)}`, m.periodD != null && `${m.periodD}d period`, m.illum != null && `${(m.illum * 100).toFixed(0)}% lit`].filter(Boolean).join(" · ") || "–";
    return `<tr><td>${esc(b.label)}</td><td>${esc(dist)}</td><td>${esc(notes)}</td></tr>`;
  }).join("");
}
function updateSolarSystem(list) {
  const v = state.viewer, seen = new Set();
  const eh = state.solar.earthHelio;
  if (!eh || !state.solar.active) return;
  const earthPos = helioScene(eh);
  const byId = updateSolarBodies(list.filter((f) => f.kind === "solar" && f.helio), seen);
  solarAdd("sol-earth", earthPos, discBillboard("#57a6ff", false), 28, null, "Earth");
  seen.add("sol-earth");
  const kk = 1000 * (AU_SCENE / 149597870.7) * SAT_EX;
  for (const f of list) {
    if (f.kind !== "satellite" || !f.eciKm) continue;
    const id = `sol-${f.id}`;
    const pos = new Cesium.Cartesian3(earthPos.x + f.eciKm.x * kk, earthPos.y + f.eciKm.z * kk, earthPos.z - f.eciKm.y * kk);
    solarAdd(id, pos, discBillboard("#c9a7ff", false), 12, f, null);
    seen.add(id);
  }
  let ci = 0;
  for (const f of list) {
    if (f.kind !== "craft") continue;
    const ap = f.meta && f.meta.anchor && byId[f.meta.anchor];
    if (!ap) continue;
    const ang = (ci++) * 2.4;
    const pos = new Cesium.Cartesian3(ap.x + Math.cos(ang) * 60000, ap.y + Math.sin(ang) * 60000, ap.z);
    solarAdd(`sol-${f.id}`, pos, discBillboard("#ffd23f", false), 18, f, f.label, 3e6);
    seen.add(`sol-${f.id}`);
  }
  for (const [id, e] of state.solar.entities) if (!seen.has(id)) { v.entities.remove(e); state.solar.entities.delete(id); }
  v.scene.requestRender();
}
// ---- Overlay layers: independently toggled globe groups, each fed by our own
// backend (never providers directly). Airports reuse the hub entities.
const OVERLAYS = {
  airports: { label: "Airports" },
  ports: { url: "/api/sea/ports", list: "ports" },
  stops: { url: "/api/streets/stops", list: "stops" },
  quakes: { url: "/api/hazards/quakes", list: "quakes" },
  events: { url: "/api/hazards/events", list: "events" },
  fireballs: { url: "/api/space/weather", list: "fireballs" },
  terminator: { computed: true },
};
state.overlays = new Map();
state.overlayData = new Map();
state.layersOn = (() => {
  const d = { airports: true, quakes: true, terminator: true };
  try { return { ...d, ...JSON.parse(localStorage.getItem("skytrack-layers") || "{}") }; } catch { return d; }
})();
state.sim = { playing: false, speed: 86400, dateMs: null };
state.systems = (() => {
  const d = { rail: true, metro: true, tram: true, bus: true };
  try { return { ...d, ...JSON.parse(localStorage.getItem("skytrack-systems") || "{}") }; } catch { return d; }
})();
function saveSystems() { try { localStorage.setItem("skytrack-systems", JSON.stringify(state.systems)); } catch { /* private mode */ } }
function saveLayersOn() { try { localStorage.setItem("skytrack-layers", JSON.stringify(state.layersOn)); } catch { /* private mode */ } }
function overlayStyle(kind, r) {
  if (kind === "quakes") {
    const m = r.mag || 0;
    return { img: discBillboard(m >= 6 ? "#e07a4f" : "#ffb454", false), px: Math.min(48, 16 + m * 4), label: `M${m}`, far: 3e7 };
  }
  if (kind === "events") return { img: discBillboard("#7cc7ff", false), px: 26, label: String(r.title || "event").slice(0, 24), far: 3e7 };
  if (kind === "fireballs") return { img: discBillboard("#7cfc98", false), px: 22, label: String(r.dateUtc || "fireball").slice(0, 10), far: 3e7 };
  return { img: discBillboard("#57e6ff", false), px: 18, label: r.code || r.id, far: 1.2e7 };
}
function overlayTrack(kind, r) {
  if (kind === "quakes") return { id: `quake-${r.id}`, kind: "quake", lat: r.lat, lon: r.lon, altM: 0, velKmh: null, hdg: null, label: `M${r.mag} ${r.place}`, meta: { mag: r.mag, place: r.place, depthKm: r.depthKm, status: r.status, timeUtc: r.timeMs ? new Date(r.timeMs).toISOString() : null }, src: "usgs" };
  if (kind === "events") return { id: `event-${r.id}`, kind: "event", lat: r.lat, lon: r.lon, altM: 0, velKmh: null, hdg: null, label: r.title, meta: { categories: r.categories, closed: r.closed, timeUtc: r.timeMs ? new Date(r.timeMs).toISOString() : null }, src: "eonet" };
  if (kind === "fireballs") return { id: `fb-${r.id}`, kind: "fireball", lat: r.lat, lon: r.lon, altM: 0, velKmh: null, hdg: null, label: `Fireball ${String(r.dateUtc || "").slice(0, 10)}`, meta: { dateUtc: r.dateUtc, energyKt: r.energyKt, velKms: r.velKms }, src: "cneos" };
  if (kind === "ports") return { id: `port-${r.code}`, kind: "port", lat: r.lat, lon: r.lon, altM: 0, velKmh: null, hdg: null, label: r.name, meta: { city: r.city }, src: "static" };
  return { id: `stop-${r.id}`, kind: "stop", lat: r.lat, lon: r.lon, altM: 0, velKmh: null, hdg: null, label: r.name, meta: { city: r.city, routes: r.routes, modes: r.modes }, src: "static" };
}
async function refreshOverlay(id) {
  const def = OVERLAYS[id];
  if (!def || !def.url || !state.layersOn[id]) return;
  try {
    const d = await fetchJSON(def.url);
    const rows = (d[def.list] || []).slice(0, 500);
    clearOverlay(id);
    const ids = new Set(), data = new Map();
    for (const r of rows) {
      const t = overlayTrack(id, r);
      const st = overlayStyle(id, r);
      const eid = `ov-${id}-${t.id}`;
      const e = state.viewer.entities.add({ id: eid, position: Cesium.Cartesian3.fromDegrees(t.lon, t.lat, 5000),
        billboard: { image: st.img, width: st.px, height: st.px },
        label: { text: st.label, font: "11px 'IBM Plex Mono', monospace", fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(0, -20), distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, st.far) } });
      e.overlay = { group: id, id: t.id };
      ids.add(eid); data.set(t.id, t);
    }
    state.overlays.set(id, ids); state.overlayData.set(id, data);
    state.viewer.scene.requestRender();
  } catch { /* keep old frame; /api/layers shows state */ }
}
function clearOverlay(id) {
  for (const eid of state.overlays.get(id) || []) {
    const e = state.viewer.entities.getById(eid);
    if (e) state.viewer.entities.remove(e);
  }
  state.overlays.delete(id); state.overlayData.delete(id);
}
function applyAirports() {
  for (const a of state.airports) a.show = (state.domain === "sky" && state.layersOn.airports !== false);
}
function setLayerOverlay(id, on) {
  state.layersOn[id] = on; saveLayersOn();
  if (id === "airports") applyAirports();
  else if (id === "terminator") { if (on) refreshTerminator(); else clearTerminator(); }
  else if (on) refreshOverlay(id); else clearOverlay(id);
  announce(`${id} layer ${on ? "shown" : "hidden"}`);
  refreshLayers();
  state.viewer.scene.requestRender();
}
function timeAgo(t) {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}
async function refreshLayers() {
  let d;
  try { d = await fetchJSON("/api/layers"); }
  catch { return; }
  const box = document.getElementById("layerRows");
  if (!box) return;
  const overlayIds = new Set(Object.keys(OVERLAYS));
  const dots = { live: "●", delayed: "◐", cached: "◐", mixed: "◑", static: "○", unavailable: "✕" };
  box.innerHTML = d.layers.map((l) => {
    const ctl = overlayIds.has(l.id)
      ? `<input type="checkbox" data-layer="${esc(l.id)}" ${state.layersOn[l.id] ? "checked" : ""} aria-label="${esc(l.label)} layer" />`
      : `<span class="muted-sm" title="switch tracking mode to view">mode</span>`;
    const when = l.updatedMs ? esc(timeAgo(l.updatedMs)) : (l.state === "static" ? "static" : "—");
    return `<label class="lrow"><span aria-hidden="true">${dots[l.state] || "?"}</span>${ctl}<span>${esc(l.label)}</span> <span class="muted-sm">${esc(l.state)}${l.note ? ` · ${esc(l.note)}` : ""} · ${when}</span></label>`;
  }).join("");
  const n = d.layers.filter((l) => l.state === "live").length;
  const m = d.layers.filter((l) => l.state === "mixed").length;
  document.getElementById("layerCount").textContent = `${n}/${d.layers.length} live${m ? ` +${m} mixed` : ""}`;
  box.querySelectorAll("input[data-layer]").forEach((c) => c.addEventListener("change", () => setLayerOverlay(c.dataset.layer, c.checked)));
  refreshKp();
}
async function refreshKp() {
  try {
    const d = await fetchJSON("/api/space/weather");
    document.getElementById("kpOut").textContent = d.kp ? `Kp ${d.kp.kp} · ${d.kp.level} · ${d.kp.timeUtc || "recent"}` : "Aurora index unavailable.";
  } catch { document.getElementById("kpOut").textContent = "Aurora index unavailable."; }
}
// Day/night terminator from the subsolar point (great circle 90° away).
function terminatorPoints(lat0, lon0, n = 128) {
  const pts = [], la0 = lat0 * Math.PI / 180, lo0 = lon0 * Math.PI / 180;
  for (let i = 0; i <= n; i++) {
    const th = (i / n) * Math.PI * 2;
    const la = Math.asin(Math.max(-1, Math.min(1, Math.cos(la0) * Math.cos(th))));
    const lo = lo0 + Math.atan2(Math.sin(th), -Math.tan(la0) * Math.sin(la));
    pts.push(Cesium.Cartesian3.fromDegrees(lo * 180 / Math.PI, la * 180 / Math.PI, 1000));
  }
  return pts;
}
async function refreshTerminator() {
  if (!state.layersOn.terminator) { clearTerminator(); return; }
  try {
    const d = await fetchJSON("/api/space/solar");
    const sun = (d.bodies || []).find((b) => b.id === "solar-sun");
    if (!sun) return;
    clearTerminator();
    state.termEnt = state.viewer.entities.add({ id: "terminator", polyline: { positions: terminatorPoints(sun.lat, sun.lon), width: 2, material: new Cesium.PolylineDashMaterialProperty({ color: Cesium.Color.fromCssColorString("#ffb454").withAlpha(0.55), dashLength: 12 }) } });
  } catch { /* keep old line */ }
}
function clearTerminator() { if (state.termEnt) { try { state.viewer.entities.remove(state.termEnt); } catch {} state.termEnt = null; } }
async function wxAtCenter() {
  const out = document.getElementById("wxOut");
  if (state.solar.active) { out.textContent = "Switch to Sky, Sea, or Streets for surface weather."; return; }
  const units = document.getElementById("wxUnits").value === "imperial" ? "imperial" : "metric";
  try {
    const c = state.viewer.camera.positionCartographic;
    const lat = c.latitude * 180 / Math.PI, lon = c.longitude * 180 / Math.PI;
    out.textContent = "Loading…";
    const d = await fetchJSON(`/api/weather?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}&units=${units}`);
    const tU = units === "imperial" ? "°F" : "°C", wU = units === "imperial" ? "mph" : "km/h";
    out.textContent = `${d.summary || "—"} · ${d.temp ?? "–"}${tU} (feels ${d.feelsLike ?? "–"}${tU}) · wind ${d.windKmh ?? "–"} ${wU}${d.windDeg != null ? ` @ ${Math.round(d.windDeg)}°` : ""} · humidity ${d.humidity ?? "–"}% · AQI ${d.aqi ?? "–"}${d.cached ? " · cached" : ""}`;
  } catch { out.textContent = "Weather unavailable right now."; }
}
function simBadge() {
  document.getElementById("simBadge").textContent = state.sim.playing && state.sim.dateMs
    ? `Simulating ${new Date(state.sim.dateMs).toISOString().slice(0, 10)} — planets only; satellites stay live`
    : "Live positions";
}
async function simTick(auto = true) {
  if (auto && REDUCED) return; // autoplay off under reduced motion; manual date still works
  if (!state.sim.playing || state.domain !== "space" || !state.solar.active || document.hidden) return;
  state.sim.dateMs = (state.sim.dateMs || Date.now()) + state.sim.speed * 2000;
  try {
    const d = await fetchJSON(`/api/space/solar?date=${new Date(state.sim.dateMs).toISOString()}`);
    if (d.earthHelio) state.solar.earthHelio = d.earthHelio;
    updateSolarBodies(d.bodies || [], new Set());
    simBadge();
    state.viewer.scene.requestRender();
  } catch { /* keep last frame */ }
}
function initViewer() {
  const esri = new Cesium.UrlTemplateImageryProvider({
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    credit: "Esri World Imagery",
  });
  const osm = new Cesium.UrlTemplateImageryProvider({
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", credit: "© OpenStreetMap",
  });
  const labels = new Cesium.UrlTemplateImageryProvider({
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    credit: "Esri",
  });
  // Google tiles need an API key for production use; direct endpoints work for demo.
  // Esri stays available as the compliant free option (see docs).
  const googleSat = new Cesium.UrlTemplateImageryProvider({
    url: "https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    subdomains: ["mt0", "mt1", "mt2", "mt3"], credit: "Imagery © Google",
  });
  const googleHyb = new Cesium.UrlTemplateImageryProvider({
    url: "https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    subdomains: ["mt0", "mt1", "mt2", "mt3"], credit: "Imagery © Google",
  });
  const layerFor = (p) => new Cesium.ImageryLayer(p);
  const viewer = new Cesium.Viewer("globe", {
    baseLayer: layerFor(googleSat),
    baseLayerPicker: false, geocoder: false, homeButton: true,
    timeline: false, animation: false, fullscreenButton: false,
    requestRenderMode: true,
    // Never refuse a context ourselves: lets CPU (SwiftShader/llvmpipe)
    // rendering through wherever the browser permits it.
    contextOptions: { webgl: { failIfMajorPerformanceCaveat: false, powerPreference: "default" } },
    skyAtmosphere: new Cesium.SkyAtmosphere(),
  });
  state.imagery = { sat: [googleSat], hybrid: [googleHyb], street: [osm], esri: [esri, labels] };
  state.viewer = viewer;
  window.__viewer = viewer; // debug/test seam: lets automation inspect globe state
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(60, 20, 30000000) });
  if (!reduce) viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(60, 25, 16000000), duration: flyDur() });
  viewer.scene.requestRender();
  return viewer;
}
function setLayer(name) {
  const v = state.viewer, layers = v.imageryLayers;
  layers.removeAll();
  for (const p of state.imagery[name]) layers.add(new Cesium.ImageryLayer(p));
  document.querySelectorAll(".layers button").forEach((b) => {
    const on = b.dataset.lyr === name;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  v.scene.requestRender();
}
function ensureSingle(v, f, pos) {
  const id = moverId(f);
  // Solar bodies glow large; far-belt satellites (GEO/GNSS) render larger so
  // they stay readable at high altitude. Labels for solar/craft stay visible
  // from much farther out so the bodies can actually be found.
  const px = f.kind === "solar" ? 42 : (f.kind === "satellite" && (f.altM || 0) > 20000000 ? 44 : 30);
  const labelFar = f.kind === "solar" ? 3e7 : (f.kind === "craft" ? 4e6 : 9e6);
  let e = state.entities.get(id);
  if (!e) {
    e = v.entities.add({
      id, position: pos, show: !state.solar.active,
      billboard: { image: iconFor(f), width: px, height: px, scaleByDistance: new Cesium.NearFarScalar(2e5, 1.3, 2e7, 0.45), alignedAxis: Cesium.Cartesian3.ZERO },
      label: { text: moverLabel(f), font: "12px 'IBM Plex Mono', monospace", fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(0, -32), distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, labelFar) },
    });
    state.entities.set(id, e);
    e._hdg = f.hdg;
  } else {
    e.position = pos;
    if (f.hdg != null && (e._hdg == null || Math.abs(f.hdg - e._hdg) > 5)) {
      e.billboard.image = iconFor(f);
      e._hdg = f.hdg;
    }
  }
  e.track = f; e.cluster = null;
  return e;
}
function updateAirportCounts(list) {
  // Count tracks per nearest airport hub from the current snapshot for P4 airport board
  const airportCounts = new Map();
  for (const f of list) {
    if (f.near && f.near.iata) {
      airportCounts.set(f.near.iata, (airportCounts.get(f.near.iata) || 0) + 1);
    }
  }
  // Update ticker airport section
  const airportSection = document.getElementById("airportSection");
  if (!airportSection) return;
  if (airportCounts.size === 0) {
    airportSection.hidden = true;
    return;
  }
  let parts = [];
  for (const [iata, count] of airportCounts) {
    parts.push(`${iata}: ${count}`);
  }
  airportSection.textContent = parts.slice(0, 3).join(" | ");
  airportSection.hidden = false;
}

function upsert(list) {
  const v = state.viewer, seen = new Set();
  for (const f of list) if (!f.hex) f.hex = f.id; // movers key on id; sky tracks on hex
  if (state.domain === "streets") list = list.filter((f) => !f.meta || !f.meta.system || state.systems[f.meta.system] !== false);
  // Track airport counts for P4 airport board (sky only)
  if (state.domain === "sky") updateAirportCounts(list);
  else { const s = document.getElementById("airportSection"); if (s) s.hidden = true; }
  // Every mover renders as its own symbol — no numbered badges by design.
  for (const f of list.slice(0, 1200)) {
    ensureSingle(v, f, Cesium.Cartesian3.fromDegrees(f.lon, f.lat, Math.max(f.altM || 10000, 3000)));
    seen.add(f.hex);
  }
  for (const [id, e] of state.entities) if (!seen.has(id)) { v.entities.remove(e); state.entities.delete(id); }
  for (const f of list.slice(0, 1200)) pushTrail(f);
  state.all = list;
  updateTicker(list, state.domain);
  if (state.domain === "space" && state.solar.earthHelio) {
    if (!state.solar.active) enterSolarSystem();
    else updateSolarSystem(list);
  }
  drawSelectedTrail();
  v.scene.render();
}
function drawSelectedTrail() {
  const v = state.viewer;
  if (state.trailEnt) { v.entities.remove(state.trailEnt); state.trailEnt = null; }
  const t = state.selectedHex && state.trails.get(state.selectedHex);
  if (!t || t.length < 2) return;
  state.trailEnt = v.entities.add({ polyline: { positions: Cesium.Cartesian3.fromDegreesArrayHeights(t.flatMap((p) => [p[1], p[0], 10500])), width: 2, material: Cesium.Color.fromCssColorString("#ffb454") } });
}
// Solar tour: cycle through solar bodies + craft, flying the camera to each
// and opening its dossier — the bodies are spread planet-wide, so the tour is
// how you actually visit them.
function solarTour() {
  const bodies = state.all.filter((f) => f.kind === "solar" || f.kind === "craft");
  if (!bodies.length) return;
  state.tourIdx = ((state.tourIdx == null ? -1 : state.tourIdx) + 1) % bodies.length;
  const f = bodies[state.tourIdx];
  show(moverId(f));
  if (!state.solar.active) {
    try { state.viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(f.lon, f.lat, 8000000), duration: flyDur() }); } catch { /* globe not ready */ }
    return;
  }
  try {
    const e = state.solar.entities.get(`sol-${moverId(f)}`);
    if (!e || !e._scenePos) return;
    const p = e._scenePos, dist = f.id === "solar-sun" ? 6e6 : 1.5e6;
    state.viewer.camera.flyTo({ destination: new Cesium.Cartesian3(p.x, p.y + dist * 0.6, p.z + dist * 0.8), duration: flyDur() });
  } catch { /* scene not ready */ }
}
function setFollow(hex) {
  const v = state.viewer;
  state.followHex = (state.followHex === hex) ? null : hex;
  const e = state.followHex && (state.solar.entities.get(`sol-${state.followHex}`) || state.entities.get(state.followHex));
  v.trackedEntity = (e && !e.cluster) ? e : undefined;
  const on = !!state.followHex;
  document.getElementById("follow").classList.toggle("on", on);
  document.getElementById("follow").setAttribute("aria-pressed", on ? "true" : "false");
  if (on) announce(`Following ${moverLabel((e && e.track) || {})}`);
  v.scene.requestRender();
}
async function loadAirports() {
  const v = state.viewer;
  try {
    const d = await fetchJSON("/api/airports");
    for (const a of d.airports || []) {
      const ent = v.entities.add({
        id: `ap:${a.iata}`, position: Cesium.Cartesian3.fromDegrees(a.lon, a.lat, 5000),
        point: { pixelSize: 7, color: Cesium.Color.fromCssColorString("#57e6ff"), outlineColor: Cesium.Color.BLACK, outlineWidth: 2 },
        label: { text: `${a.iata}`, font: "11px 'IBM Plex Mono', monospace", fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(0, -16), distanceDisplayCondition: new Cesium.DistanceDisplayCondition(3e6, 3e7) },
      });
      ent.airport = a;
      ent.show = state.domain === "sky" && state.layersOn.airports !== false; // hub dots belong to sky mode only
      state.airports.push(ent);
    }
    v.scene.requestRender();
  } catch { /* airports are decoration; map works without them */ }
}
function drawRoute(arc) {
  const v = state.viewer;
  if (state.routeEnt) { v.entities.remove(state.routeEnt); state.routeEnt = null; }
  if (!arc || !arc.length) return;
  state.routeEnt = v.entities.add({ polyline: { positions: Cesium.Cartesian3.fromDegreesArrayHeights(arc.flatMap((p) => [p[1], p[0], 11000])), width: 2, material: Cesium.Color.fromCssColorString("#57e6ff") } });
  v.scene.requestRender();
}
async function showOverlay(group, id) {
  const t = state.overlayData.get(group) && state.overlayData.get(group).get(id);
  if (!t) return;
  renderDomainDossier(t, state.domain);
  state.selectedHex = null;
  drawRoute(null);
  document.getElementById("follow").classList.remove("on");
  if (group !== "stops") return;
  const ul = document.getElementById("pServices");
  ul.innerHTML = "<li>loading departures…</li>";
  try {
    const b = await fetchJSON(`/api/streets/board?lat=${t.lat}&lon=${t.lon}`);
    if (b.stop && b.departures.length) {
      const groups = {};
      for (const x of b.departures.slice(0, 9)) (groups[x.mode || "other"] ||= []).push(x);
      ul.innerHTML = Object.entries(groups).map(([mode, xs]) =>
        `<li><b>${esc(mode)}</b> ${xs.map((d) => `${esc(d.line || "")} ${esc(d.destination)} · ${esc(String(d.expectedUtc || "").slice(11, 16))}${d.realtime ? "" : " (sched)"}`).join(" · ")}</li>`).join("");
      document.getElementById("pFine").textContent = `Live board: ${b.stop.name} (Entur, Norway). Times local to stop; “sched” rows are timetable-based.`;
    } else {
      ul.innerHTML = ((t.meta && t.meta.routes) || []).map((r) => `<li>${esc(r)}</li>`).join("") || "<li>–</li>";
      document.getElementById("pFine").textContent = "Static routes. Live boards cover Norway via Entur.";
    }
  } catch { ul.innerHTML = "<li>board unavailable</li>"; }
}
async function show(hex) {
  const o = findOverlayTrack(hex);
  if (o) { showOverlay(o.group, o.id); return; }
  let f;
  try {
    const d = await fetchJSON(detailUrlFor(hex));
    f = d.flight || d.vessel || d.vehicle || d.object; setMode("live", d.src);
  } catch {
    f = state.all.find((x) => moverId(x) === hex);
  }
  if (!f) {
    // Live data churns: a searched mover can rotate out before the click lands.
    document.getElementById("pTitle").textContent = "No longer tracked";
    document.getElementById("pSub").textContent = "That mover left live coverage. Search again for current results.";
    announce("Selected mover is no longer tracked");
    return;
  }
  renderDossier(f);
  state.selectedHex = hex;
  drawRoute(f.route && f.route.arc);
  drawSelectedTrail();
  const following = state.followHex === hex;
  document.getElementById("follow").classList.toggle("on", following);
  document.getElementById("follow").setAttribute("aria-pressed", following ? "true" : "false");
  const e = state.entities.get(hex);
  if (e && !e.cluster) state.viewer.flyTo(e, { duration: flyDur() });
}
function searchPool() {
  // Domain movers plus enabled overlay rows: every clickable thing is findable
  // (and keyboard-reachable) through search, not just canvas picking.
  const pool = state.all.slice();
  for (const map of state.overlayData.values()) {
    if (!map) continue;
    for (const t of map.values()) pool.push(t);
  }
  return pool;
}
function findOverlayTrack(id) {
  for (const [group, map] of state.overlayData) {
    if (map && map.has(id)) return { group, id };
  }
  return null;
}
function wireSearch() {
  const box = document.getElementById("search"), out = document.getElementById("results");
  const openFirst = () => { const li = out.querySelector("li"); if (li) show(li.dataset.id); };
  box.addEventListener("keydown", (e) => { if (e.key === "Enter") openFirst(); if (e.key === "Escape") { box.value = ""; out.innerHTML = ""; } });
  box.addEventListener("input", () => {
    const q = box.value.trim().toUpperCase();
    const list = (q ? searchPool().filter((f) => searchFields(f).toUpperCase().includes(q)) : []).slice(0, 8);
    out.innerHTML = list.map((f) => {
      const al = airlineFor(f);
      const iso = al.iso && /^[a-z]{2}$/.test(al.iso) ? al.iso : null;
      return `<li data-id="${esc(moverId(f))}" tabindex="0" role="option">${iso ? `<img src="${esc(flag(iso))}" alt="" loading="lazy" />` : ""}<span>${esc(moverLabel(f))}</span></li>`;
    }).join("");
    const open = (id) => { const o = findOverlayTrack(id); if (o) showOverlay(o.group, o.id); else show(id); };
    out.querySelectorAll("li").forEach((li) => {
      li.addEventListener("click", () => open(li.dataset.id));
      li.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(li.dataset.id); } });
    });
  });
}
async function live() {
  try {
    const s = await fetchJSON(snapshotUrl());
    setMode(modeFor(s.src), `${DOMAINS[state.domain].label} · ${s.src}`);
    if (s.earthHelio) state.solar.earthHelio = s.earthHelio;
    upsert(s.tracks || s.movers || []);
    return true;
  } catch { return false; }
}
function connectWS() {
  let ws = null;
  try { ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`); } catch { return; }
  state.ws = ws;
  ws.onopen = () => sendSub();
  ws.onmessage = (ev) => {
    try { const m = JSON.parse(ev.data); if (m.op === "diff" && m.upsert) { setMode(modeFor(m.src), `${DOMAINS[state.domain].label} · ${m.src}`); upsert(m.upsert); } } catch { /* keep last frame */ }
  };
  ws.onclose = () => { state.ws = null; setTimeout(connectWS, 5000); };
}
(async function boot() {
  let viewer = null;
  try { viewer = initViewer(); }
  catch (e) {
    document.getElementById("noglMsg").textContent = "3D failed to start: " + (e && e.message ? e.message : e);
    document.getElementById("nogl").hidden = false;
    return;
  }
  if (window.__softwareGL) {
    // CPU rendering: fewer pixels, capped frame rate, same picture.
    try { viewer.resolutionScale = 0.75; viewer.targetFrameRate = 30; } catch { /* older engine */ }
    announce("Software rendering detected: the globe uses CPU graphics and may feel slower.");
  }
  wireSearch();
  wireModes();
  document.querySelectorAll(".layers button").forEach((b) => b.addEventListener("click", () => setLayer(b.dataset.lyr)));
  document.getElementById("close").addEventListener("click", () => { drawRoute(null); state.selectedHex = null; drawSelectedTrail(); resetDossier(state.domain); announce("Details closed"); });
  document.getElementById("follow").addEventListener("click", () => { if (state.selectedHex) setFollow(state.selectedHex); });
  const stepZoom = (dir) => {
    const v = state.viewer;
    try {
      const h = v.camera.positionCartographic.height;
      if (dir > 0) v.camera.zoomIn(h * 0.35); else v.camera.zoomOut(h * 0.5);
      v.scene.requestRender();
    } catch { /* globe not ready */ }
  };
  document.getElementById("zin").addEventListener("click", () => stepZoom(1));
  document.getElementById("zout").addEventListener("click", () => stepZoom(-1));
  document.getElementById("tour").addEventListener("click", () => solarTour());
  document.querySelectorAll("#systemRow input[data-system]").forEach((c) => {
    c.checked = state.systems[c.dataset.system] !== false;
    c.addEventListener("change", () => {
      state.systems[c.dataset.system] = c.checked; saveSystems();
      announce(`${c.dataset.system} ${c.checked ? "shown" : "hidden"}`);
      live();
    });
  });
  document.getElementById("wxGo").addEventListener("click", () => wxAtCenter());
  document.getElementById("simPlay").addEventListener("click", () => {
    state.sim.playing = !state.sim.playing;
    if (state.sim.playing && !state.sim.dateMs) state.sim.dateMs = Date.now();
    const b = document.getElementById("simPlay");
    b.textContent = state.sim.playing ? "Pause animation" : "Play animation";
    b.setAttribute("aria-pressed", state.sim.playing ? "true" : "false");
    simBadge();
  });
  document.getElementById("simSpeed").addEventListener("change", (e) => { state.sim.speed = Number(e.target.value) || 86400; });
  document.getElementById("simDate").addEventListener("change", (e) => {
    const ms = Date.parse(e.target.value);
    if (Number.isFinite(ms)) { state.sim.dateMs = ms; simTick(false); }
  });
  document.getElementById("simReset").addEventListener("click", () => {
    state.sim.playing = false; state.sim.dateMs = null;
    document.getElementById("simPlay").textContent = "Play animation";
    document.getElementById("simPlay").setAttribute("aria-pressed", "false");
    document.getElementById("simDate").value = "";
    simBadge();
    live();
  });
  setInterval(simTick, 2000);
  loadAirports();
  const ok = await live();
  if (!ok) { setMode("demo"); upsert(DEMO); }
  else connectWS();
  setInterval(async () => { if (state.mode !== "live" || document.hidden) return; try { const s = await fetchJSON(snapshotUrl()); if (s.earthHelio) state.solar.earthHelio = s.earthHelio; upsert(s.tracks || s.movers || []); } catch { /* ws covers gaps */ } }, 15000);
  setInterval(async () => {
    if (document.hidden) return; // background tabs: no polling, no animation
    refreshLayers();
    for (const id of Object.keys(OVERLAYS)) {
      if (id === "airports" || id === "terminator" || !state.layersOn[id]) continue;
      refreshOverlay(id);
    }
    if (state.layersOn.terminator) refreshTerminator();
  }, 60000);
  refreshLayers();
  refreshTerminator();
  if (state.layersOn.quakes) refreshOverlay("quakes");
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction((click) => {
    const p = viewer.scene.pick(click.position);
    if (!p || !p.id) return;
    if (p.id.track) { const t = p.id.track; show(moverId(t)); return; }
    if (p.id.overlay) { showOverlay(p.id.overlay.group, p.id.overlay.id); return; }
    if (p.id.airport) {
      viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(p.id.airport.lon, p.id.airport.lat, 1500000), duration: flyDur() });
      return;
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
})();
