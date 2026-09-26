// SkyTrack 3D frontend. Talks only to same-origin /api + ws (see docs/TECHFLOW.md).
// Inline DEMO keeps the page presentable when no backend is reachable.
const DEMO = [
  { hex: "a1b2c3", callsign: "AIC302", lat: 28.1, lon: 62.5, velKmh: 880, hdg: 290, altM: 11500, origin: "DEL", dest: "LHR", type: "B788", src: "demo", near: { iata: "DEL", city: "Delhi", distKm: 900 } },
  { hex: "d4e5f6", callsign: "BAW249", lat: 45.5, lon: -20.0, velKmh: 905, hdg: 260, altM: 11800, origin: "LHR", dest: "JFK", type: "B77W", src: "demo", near: { iata: "LHR", city: "London", distKm: 1400 } },
  { hex: "112233", callsign: "SIA21", lat: 35.0, lon: 135.0, velKmh: 920, hdg: 90, altM: 12100, origin: "SIN", dest: "NRT", type: "A359", src: "demo", near: { iata: "NRT", city: "Tokyo", distKm: 700 } },
];
const AIRLINE_NAMES = { AIC: ["Air India", "in"], BAW: ["British Airways", "gb"], SIA: ["Singapore Airlines", "sg"], UAE: ["Emirates", "ae"], DLH: ["Lufthansa", "de"], QFA: ["Qantas", "au"] };
const flag = (iso) => (iso ? `https://flagcdn.com/w40/${iso}.png` : null);
const state = { viewer: null, entities: new Map(), routeEnt: null, mode: "demo", all: [], imagery: {} };

function badge(prefix) {
  const c = document.createElement("canvas"); c.width = c.height = 72;
  const g = c.getContext("2d");
  let h = 0; for (const ch of prefix) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const grad = g.createLinearGradient(0, 0, 72, 72);
  grad.addColorStop(0, "#0b2036"); grad.addColorStop(1, `hsl(${h} 70% 38%)`);
  g.fillStyle = grad;
  g.beginPath(); g.roundRect(2, 2, 68, 68, 16); g.fill();
  g.strokeStyle = "#57e6ff"; g.lineWidth = 3; g.stroke();
  g.fillStyle = "#eef4ff"; g.font = "700 24px 'IBM Plex Mono', monospace";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(prefix.slice(0, 3), 36, 38);
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
  const viewer = new Cesium.Viewer("globe", {
    imageryProvider: esri,
    baseLayerPicker: false, geocoder: false, homeButton: true,
    timeline: false, animation: false, fullscreenButton: false,
    requestRenderMode: true, maximumRenderTimeChange: Infinity,
    skyAtmosphere: new Cesium.SkyAtmosphere(),
  });
  viewer.scene.globe.enableLighting = false;
  state.imagery = { sat: [esri], hybrid: [esri, labels], street: [osm] };
  state.viewer = viewer;
  // Opening sweep: one orchestrated motion, then stillness.
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(60, 20, 30000000) });
  if (!reduce) viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(60, 25, 16000000), duration: 3 });
  viewer.scene.requestRender();
  return viewer;
}
function setLayer(name) {
  const v = state.viewer, layers = v.imageryLayers;
  layers.removeAll();
  for (const p of state.imagery[name]) layers.addImageryProvider(p);
  document.querySelectorAll(".layers button").forEach((b) => b.classList.toggle("on", b.dataset.lyr === name));
  v.scene.requestRender();
}
function upsert(list) {
  const v = state.viewer, seen = new Set();
  for (const f of list.slice(0, 800)) {
    seen.add(f.hex);
    const pos = Cesium.Cartesian3.fromDegrees(f.lon, f.lat, Math.max(f.altM || 10000, 3000));
    let e = state.entities.get(f.hex);
    if (!e) {
      const prefix = (f.callsign || "???").trim().slice(0, 3).toUpperCase() || "???";
      e = v.entities.add({
        id: f.hex, position: pos,
        billboard: { image: badge(prefix), width: 34, height: 34, scaleByDistance: new Cesium.NearFarScalar(2e5, 1.4, 2e7, 0.5) },
        label: { text: f.callsign || f.hex, font: "12px 'IBM Plex Mono', monospace", fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(0, -30), distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 9e6) },
      });
      e.track = f;
      state.entities.set(f.hex, e);
    } else { e.position = pos; e.track = f; }
  }
  for (const [hex, e] of state.entities) if (!seen.has(hex)) { v.entities.remove(e); state.entities.delete(hex); }
  state.all = list;
  document.getElementById("count").textContent = list.length.toLocaleString();
  const top = {};
  for (const f of list) top[f.originCountry || "?"] = (top[f.originCountry || "?"] || 0) + 1;
  document.getElementById("topList").textContent = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${k} ${n.toLocaleString()}`).join(" · ");
  v.scene.requestRender();
}
function setMode(mode, src) {
  state.mode = mode;
  document.getElementById("modeBadge").textContent = mode === "live" ? `live · ${src}` : mode;
  document.getElementById("liveDot").classList.toggle("on", mode === "live");
}
async function fetchJSON(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
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
  const prefix = (f.callsign || "").trim().slice(0, 3).toUpperCase();
  const [aname, aiso] = AIRLINE_NAMES[prefix] || [null, f.iso || null];
  document.getElementById("pTitle").textContent = `${f.callsign || f.hex}${f.origin && f.dest ? ` · ${f.origin}→${f.dest}` : ""}`;
  document.getElementById("pSub").textContent = `${aname || "Unknown operator"} · HEX ${f.hex}${f.type ? ` · ${f.type}` : ""}`;
  const fl = document.getElementById("pFlag");
  const fs = flag(aiso);
  if (fs) { fl.src = fs; fl.alt = aiso; fl.hidden = false; fl.onerror = () => (fl.hidden = true); } else fl.hidden = true;
  document.getElementById("pSpeed").textContent = `${f.velKmh} km/h`;
  document.getElementById("pAlt").textContent = f.altM != null ? `${Math.round(f.altM)} m` : "–";
  document.getElementById("pHdg").textContent = f.hdg != null ? `${Math.round(f.hdg)}°` : "–";
  document.getElementById("pVs").textContent = f.vsMs != null ? `${f.vsMs > 0 ? "+" : ""}${f.vsMs.toFixed(1)} m/s` : "–";
  document.getElementById("pNear").textContent = f.near ? `${f.near.iata} · ${f.near.distKm} km` : "–";
  document.getElementById("pCap").textContent = f.capacity ? `${f.capacity.seats} seats` : (f.cap ? `${f.cap} seats` : "–");
  document.getElementById("pRoute").textContent = f.route ? `${f.route.origin.iata} → ${f.route.dest.iata} · ${f.route.distKm.toLocaleString()} km · ${f.route.remainKm.toLocaleString()} km left` : "Position-only track";
  const sv = f.services && !f.services.unknown ? [f.services.wifi && "Wi-Fi", f.services.meals && (f.services.meals === true ? "Meals" : f.services.meals), f.services.baggage, f.services.entertainment].filter(Boolean) : (f.servicesList || ["Wi-Fi", "Meals", "Baggage", "IFE"]);
  document.getElementById("pServices").innerHTML = sv.map((s) => `<li>${s}</li>`).join("");
  const fares = f.fares || (f.route ? null : null) || demoFares(f);
  document.getElementById("pFares").innerHTML = fares ? Object.entries(fares).map(([k, v]) => `<tr><td>${k}</td><td>$${(v.avg ?? v).toLocaleString()} avg</td></tr>`).join("") : "<tr><td>route unknown</td><td>–</td></tr>";
  drawRoute(f.route && f.route.arc);
  const e = state.entities.get(hex);
  if (e) state.viewer.flyTo(e, { duration: 1.2 });
}
function demoFares(f) {
  if (!f.fares) return null;
  if (typeof f.fares.eco === "number") return { eco: { avg: f.fares.eco }, prem: { avg: f.fares.prem }, biz: { avg: f.fares.biz }, first: { avg: f.fares.first } };
  return f.fares;
}
function wireSearch() {
  const box = document.getElementById("search"), out = document.getElementById("results");
  box.addEventListener("input", () => {
    const q = box.value.trim().toUpperCase();
    const list = (q ? state.all.filter((f) => `${f.callsign || ""} ${f.origin || ""} ${f.dest || ""} ${f.hex}`.toUpperCase().includes(q)) : []).slice(0, 8);
    out.innerHTML = list.map((f) => {
      const prefix = (f.callsign || "").trim().slice(0, 3).toUpperCase();
      const [, iso] = AIRLINE_NAMES[prefix] || [];
      return `<li data-hex="${f.hex}">${iso ? `<img src="${flag(iso)}" alt="" loading="lazy" />` : ""}<span>${f.callsign || f.hex}</span></li>`;
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
  catch { document.getElementById("nogl").hidden = false; return; }
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
    if (p && p.id && p.id.track) show(p.id.track.hex);
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
})();
