// SkyTrack 3D globe. Same-origin /api + ws only. Shared dossier logic lives in shared.js.
const state = { viewer: null, entities: new Map(), routeEnt: null, trailEnt: null, mode: "demo", domain: "sky", ws: null, all: [], imagery: {}, selectedHex: null, followHex: null, trails: new Map() };
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
  state.domain = d;
  document.querySelectorAll(".modes button").forEach((b) => {
    const on = b.dataset.domain === d;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  for (const [, e] of state.entities) state.viewer.entities.remove(e);
  state.entities.clear();
  state.selectedHex = null; state.followHex = null;
  sendSub();
  live();
}
function wireModes() {
  document.querySelectorAll(".modes button").forEach((b) => b.addEventListener("click", () => setDomain(b.dataset.domain)));
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
    skyAtmosphere: new Cesium.SkyAtmosphere(),
  });
  state.imagery = { sat: [googleSat], hybrid: [googleHyb], street: [osm], esri: [esri, labels] };
  state.viewer = viewer;
  window.__viewer = viewer; // debug/test seam: lets automation inspect globe state
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(60, 20, 30000000) });
  if (!reduce) viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(60, 25, 16000000), duration: 3 });
  viewer.scene.requestRender();
  return viewer;
}
function setLayer(name) {
  const v = state.viewer, layers = v.imageryLayers;
  layers.removeAll();
  for (const p of state.imagery[name]) layers.add(new Cesium.ImageryLayer(p));
  document.querySelectorAll(".layers button").forEach((b) => b.classList.toggle("on", b.dataset.lyr === name));
  v.scene.requestRender();
}
function clusterBadge(n) {
  const c = document.createElement("canvas"); c.width = c.height = 72;
  const g = c.getContext("2d");
  g.fillStyle = "#0b2036";
  g.beginPath(); g.arc(36, 36, 33, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#ffb454"; g.lineWidth = 4; g.stroke();
  g.fillStyle = "#eef4ff"; g.font = "700 26px 'IBM Plex Mono', monospace";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(n > 99 ? "99+" : String(n), 36, 38);
  return c.toDataURL();
}
function cellFor(f, cell) { return `${Math.floor(f.lat / cell)}:${Math.floor(f.lon / cell)}`; }
function ensureSingle(v, f, pos) {
  const id = moverId(f);
  let e = state.entities.get(id);
  if (!e) {
    e = v.entities.add({
      id, position: pos,
      billboard: { image: iconFor(f), width: 30, height: 30, scaleByDistance: new Cesium.NearFarScalar(2e5, 1.3, 2e7, 0.45), alignedAxis: Cesium.Cartesian3.ZERO },
      label: { text: moverLabel(f), font: "12px 'IBM Plex Mono', monospace", fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(0, -32), distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 9e6) },
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
  // Track airport counts for P4 airport board (sky only)
  if (state.domain === "sky") updateAirportCounts(list);
  else { const s = document.getElementById("airportSection"); if (s) s.hidden = true; }
  let cell = 15;
  try { cell = Math.min(15, Math.max(0.5, v.camera.positionCartographic.height / 111320 / 10)); } catch { /* fixed grid */ }
  const groups = new Map();
  for (const f of list.slice(0, 1200)) {
    const k = cellFor(f, cell);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(f);
  }
  const CLUSTER_AT = 30; // groups this size or smaller render as individual planes
  for (const [k, g] of groups) {
    if (g.length <= CLUSTER_AT) {
      for (const f of g) {
        ensureSingle(v, f, Cesium.Cartesian3.fromDegrees(f.lon, f.lat, Math.max(f.altM || 10000, 3000)));
        seen.add(f.hex);
      }
    } else {
      const id = `c:${k}`;
      const lat = g.reduce((a, f) => a + f.lat, 0) / g.length;
      const lon = g.reduce((a, f) => a + f.lon, 0) / g.length;
      let e = state.entities.get(id);
      const pos = Cesium.Cartesian3.fromDegrees(lon, lat, 1200000);
      if (!e) {
        e = v.entities.add({
          id, position: pos,
          billboard: { image: clusterBadge(g.length), width: 44, height: 44, scaleByDistance: new Cesium.NearFarScalar(2e5, 1.5, 2e7, 0.6) },
        });
        state.entities.set(id, e);
      } else { e.position = pos; e.billboard.image = clusterBadge(g.length); }
      e.track = null; e.cluster = g;
      seen.add(id);
    }
  }
  for (const [id, e] of state.entities) if (!seen.has(id)) { v.entities.remove(e); state.entities.delete(id); }
  for (const f of list.slice(0, 1200)) pushTrail(f);
  state.all = list;
  updateTicker(list, state.domain);
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
function setFollow(hex) {
  const v = state.viewer;
  state.followHex = (state.followHex === hex) ? null : hex;
  const e = state.followHex && state.entities.get(state.followHex);
  v.trackedEntity = (e && !e.cluster) ? e : undefined;
  document.getElementById("follow").classList.toggle("on", !!state.followHex);
  v.scene.requestRender();
}
async function loadAirports() {
  const v = state.viewer;
  try {
    const d = await fetchJSON("/api/airports");
    for (const a of d.airports || []) {
      v.entities.add({
        id: `ap:${a.iata}`, position: Cesium.Cartesian3.fromDegrees(a.lon, a.lat, 5000),
        point: { pixelSize: 7, color: Cesium.Color.fromCssColorString("#57e6ff"), outlineColor: Cesium.Color.BLACK, outlineWidth: 2 },
        label: { text: `${a.iata} · ${a.nearby || 0}`, font: "11px 'IBM Plex Mono', monospace", fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(0, -16), distanceDisplayCondition: new Cesium.DistanceDisplayCondition(3e6, 3e7) },
      }).airport = a;
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
async function show(hex) {
  let f;
  try {
    const d = await fetchJSON(detailUrlFor(hex));
    f = d.flight || d.vessel || d.vehicle || d.object; setMode("live", d.src);
  } catch {
    f = state.all.find((x) => moverId(x) === hex);
    if (!f) return;
  }
  renderDossier(f);
  state.selectedHex = hex;
  drawRoute(f.route && f.route.arc);
  drawSelectedTrail();
  document.getElementById("follow").classList.toggle("on", state.followHex === hex);
  const e = state.entities.get(hex);
  if (e && !e.cluster) state.viewer.flyTo(e, { duration: 1.2 });
}
function wireSearch() {
  const box = document.getElementById("search"), out = document.getElementById("results");
  box.addEventListener("input", () => {
    const q = box.value.trim().toUpperCase();
    const list = (q ? state.all.filter((f) => searchFields(f).toUpperCase().includes(q)) : []).slice(0, 8);
    out.innerHTML = list.map((f) => {
      const al = airlineFor(f);
      return `<li data-id="${moverId(f)}">${al.iso ? `<img src="${flag(al.iso)}" alt="" loading="lazy" />` : ""}<span>${moverLabel(f)}</span></li>`;
    }).join("");
    out.querySelectorAll("li").forEach((li) => li.addEventListener("click", () => show(li.dataset.id)));
  });
}
async function live() {
  try {
    const s = await fetchJSON(snapshotUrl());
    setMode(s.src === "demo" ? "demo" : "live", `${DOMAINS[state.domain].label} · ${s.src}`);
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
    try { const m = JSON.parse(ev.data); if (m.op === "diff" && m.upsert) { setMode(m.src === "demo" ? "demo" : "live", `${DOMAINS[state.domain].label} · ${m.src}`); upsert(m.upsert); } } catch { /* keep last frame */ }
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
  wireSearch();
  wireModes();
  document.querySelectorAll(".layers button").forEach((b) => b.addEventListener("click", () => setLayer(b.dataset.lyr)));
  document.getElementById("close").addEventListener("click", () => { drawRoute(null); state.selectedHex = null; drawSelectedTrail(); });
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
  loadAirports();
  const ok = await live();
  if (!ok) { setMode("demo"); upsert(DEMO); }
  else connectWS();
  setInterval(async () => { if (state.mode !== "live") return; try { const s = await fetchJSON(snapshotUrl()); upsert(s.tracks || s.movers || []); } catch { /* ws covers gaps */ } }, 15000);
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction((click) => {
    const p = viewer.scene.pick(click.position);
    if (!p || !p.id) return;
    if (p.id.track) { const t = p.id.track; show(moverId(t)); return; }
    if (p.id.airport) {
      viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(p.id.airport.lon, p.id.airport.lat, 1500000), duration: 1.2 });
      return;
    }
    if (p.id.cluster) { // zoom toward the cluster instead of opening a dossier
      const g = p.id.cluster;
      const lat = g.reduce((a, f) => a + f.lat, 0) / g.length;
      const lon = g.reduce((a, f) => a + f.lon, 0) / g.length;
      viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(lon, lat, 2500000), duration: 1.2 });
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
})();
