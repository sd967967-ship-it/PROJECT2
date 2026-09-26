// SkyTrack 3D globe. Same-origin /api + ws only. Shared dossier logic lives in shared.js.
const state = { viewer: null, entities: new Map(), routeEnt: null, mode: "demo", all: [], imagery: {} };

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
  let e = state.entities.get(f.hex);
  if (!e) {
    e = v.entities.add({
      id: f.hex, position: pos,
      billboard: { image: planeBillboard(f.hdg), width: 30, height: 30, scaleByDistance: new Cesium.NearFarScalar(2e5, 1.3, 2e7, 0.45), alignedAxis: Cesium.Cartesian3.ZERO },
      label: { text: f.callsign || f.hex, font: "12px 'IBM Plex Mono', monospace", fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(0, -32), distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 9e6) },
    });
    state.entities.set(f.hex, e);
    e._hdg = f.hdg;
  } else {
    e.position = pos;
    if (f.hdg != null && (e._hdg == null || Math.abs(f.hdg - e._hdg) > 5)) {
      e.billboard.image = planeBillboard(f.hdg);
      e._hdg = f.hdg;
    }
  }
  e.track = f; e.cluster = null;
  return e;
}
function upsert(list) {
  const v = state.viewer, seen = new Set();
  let cell = 15;
  try { cell = Math.min(15, Math.max(0.5, v.camera.positionCartographic.height / 111320 / 10)); } catch { /* fixed grid */ }
  const groups = new Map();
  for (const f of list.slice(0, 800)) {
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
  state.all = list;
  updateTicker(list);
  v.scene.requestRender();
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
    const d = await fetchJSON(`/api/flights/${hex}`);
    f = d.flight; setMode("live", d.src);
  } catch {
    f = state.all.find((x) => x.hex === hex);
    if (!f) return;
  }
  renderDossier(f);
  drawRoute(f.route && f.route.arc);
  const e = state.entities.get(hex);
  if (e) state.viewer.flyTo(e, { duration: 1.2 });
}
function wireSearch() {
  const box = document.getElementById("search"), out = document.getElementById("results");
  box.addEventListener("input", () => {
    const q = box.value.trim().toUpperCase();
    const list = (q ? state.all.filter((f) => `${f.callsign || ""} ${f.origin || ""} ${f.dest || ""} ${f.hex}`.toUpperCase().includes(q)) : []).slice(0, 8);
    out.innerHTML = list.map((f) => {
      const al = airlineFor(f);
      return `<li data-hex="${f.hex}">${al.iso ? `<img src="${flag(al.iso)}" alt="" loading="lazy" />` : ""}<span>${f.callsign || f.hex}</span></li>`;
    }).join("");
    out.querySelectorAll("li").forEach((li) => li.addEventListener("click", () => show(li.dataset.hex)));
  });
}
async function live() {
  try {
    const s = await fetchJSON("/api/snapshot");
    setMode(s.src === "demo" ? "demo" : "live", s.src);
    upsert(s.tracks);
    return true;
  } catch { return false; }
}
function connectWS() {
  let ws = null;
  try { ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`); } catch { return; }
  ws.onmessage = (ev) => {
    try { const m = JSON.parse(ev.data); if (m.op === "diff" && m.upsert) { setMode(m.src === "demo" ? "demo" : "live", m.src); upsert(m.upsert); } } catch { /* keep last frame */ }
  };
  ws.onclose = () => setTimeout(connectWS, 5000);
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
  document.querySelectorAll(".layers button").forEach((b) => b.addEventListener("click", () => setLayer(b.dataset.lyr)));
  document.getElementById("close").addEventListener("click", () => drawRoute(null));
  const ok = await live();
  if (!ok) { setMode("demo"); upsert(DEMO); }
  else connectWS();
  setInterval(async () => { if (state.mode !== "live") return; try { const s = await fetchJSON("/api/snapshot"); upsert(s.tracks); } catch { /* ws covers gaps */ } }, 15000);
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction((click) => {
    const p = viewer.scene.pick(click.position);
    if (!p || !p.id) return;
    if (p.id.track) { show(p.id.track.hex); return; }
    if (p.id.cluster) { // zoom toward the cluster instead of opening a dossier
      const g = p.id.cluster;
      const lat = g.reduce((a, f) => a + f.lat, 0) / g.length;
      const lon = g.reduce((a, f) => a + f.lon, 0) / g.length;
      viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(lon, lat, 2500000), duration: 1.2 });
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
})();
