// SkyTrack 2D fallback map (Leaflet + Esri satellite). Used automatically when
// WebGL/Cesium is unavailable. Same data, dossier, search, and ticker as 3D via shared.js.
const state2d = { map: null, markers: new Map(), routeLine: null, all: [], layers: {} };
function initMap() {
  const googleSat = L.tileLayer("https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", { subdomains: ["mt0", "mt1", "mt2", "mt3"], maxZoom: 19, attribution: "Imagery © Google" });
  const googleHyb = L.tileLayer("https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", { subdomains: ["mt0", "mt1", "mt2", "mt3"], maxZoom: 19, attribution: "Imagery © Google" });
  const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Esri World Imagery" });
  const labels = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Esri" });
  const street = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" });
  const map = L.map("map2d", { worldCopyJump: true, minZoom: 2 }).setView([25, 20], 2);
  googleSat.addTo(map);
  state2d.layers = { sat: [googleSat], hybrid: [googleHyb], street: [street], esri: [sat, labels] };
  state2d.active = [googleSat];
  state2d.map = map;
  document.querySelectorAll(".layers button").forEach((b) => b.addEventListener("click", () => {
    state2d.active.forEach((l) => map.removeLayer(l));
    state2d.active = state2d.layers[b.dataset.lyr];
    state2d.active.forEach((l) => l.addTo(map));
    document.querySelectorAll(".layers button").forEach((x) => x.classList.toggle("on", x === b));
  }));
  return map;
}
function planeIcon(callsign) {
  const prefix = (callsign || "???").trim().slice(0, 3).toUpperCase();
  return L.divIcon({
    className: "plane-badge",
    html: `<span>${prefix}</span>`,
    iconSize: [34, 34], iconAnchor: [17, 17],
  });
}
function upsert2d(list) {
  const map = state2d.map, seen = new Set();
  if (!state2d.group) {
    state2d.group = (typeof L.markerClusterGroup === "function")
      ? L.markerClusterGroup({ maxClusterRadius: 60 }).addTo(map)
      : L.layerGroup().addTo(map);
  }
  state2d.group.clearLayers();
  state2d.tracks = new Map();
  for (const f of list.slice(0, 800)) {
    seen.add(f.hex);
    state2d.tracks.set(f.hex, f);
    const m = L.marker([f.lat, f.lon], { icon: planeIcon(f.callsign), title: f.callsign || f.hex });
    m.on("click", () => show2d(f.hex));
    state2d.group.addLayer(m);
  }
  state2d.all = list;
  updateTicker(list);
}
function drawRoute2d(arc) {
  if (state2d.routeLine) { state2d.map.removeLayer(state2d.routeLine); state2d.routeLine = null; }
  if (!arc || !arc.length) return;
  state2d.routeLine = L.polyline(arc, { color: "#57e6ff", weight: 2 }).addTo(state2d.map);
}
async function show2d(hex) {
  let f;
  try {
    const d = await fetchJSON(`/api/flights/${hex}`);
    f = d.flight; setMode("live", d.src);
  } catch {
    f = state2d.all.find((x) => x.hex === hex);
    if (!f) return;
  }
  renderDossier(f);
  drawRoute2d(f.route && f.route.arc);
  const t = state2d.tracks && state2d.tracks.get(hex);
  if (t) state2d.map.flyTo([t.lat, t.lon], Math.max(state2d.map.getZoom(), 5), { duration: 1.2 });
}
function wireSearch2d() {
  const box = document.getElementById("search"), out = document.getElementById("results");
  box.addEventListener("input", () => {
    const q = box.value.trim().toUpperCase();
    const list = (q ? state2d.all.filter((f) => `${f.callsign || ""} ${f.origin || ""} ${f.dest || ""} ${f.hex}`.toUpperCase().includes(q)) : []).slice(0, 8);
    out.innerHTML = list.map((f) => {
      const al = airlineFor(f);
      return `<li data-hex="${f.hex}">${al.iso ? `<img src="${flag(al.iso)}" alt="" loading="lazy" />` : ""}<span>${f.callsign || f.hex}</span></li>`;
    }).join("");
    out.querySelectorAll("li").forEach((li) => li.addEventListener("click", () => show2d(li.dataset.hex)));
  });
}
async function live2d() {
  try {
    const s = await fetchJSON("/api/snapshot");
    setMode(s.src === "demo" ? "demo-2d" : "live-2d", s.src);
    upsert2d(s.tracks);
    return true;
  } catch { return false; }
}
function connectWS2d() {
  let ws = null;
  try { ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`); } catch { return; }
  ws.onmessage = (ev) => {
    try { const m = JSON.parse(ev.data); if (m.op === "diff" && m.upsert) { setMode(m.src === "demo" ? "demo-2d" : "live-2d", m.src); upsert2d(m.upsert); } } catch { /* keep last frame */ }
  };
  ws.onclose = () => setTimeout(connectWS2d, 5000);
}
(async function boot2d() {
  document.getElementById("globe").hidden = true;
  document.getElementById("map2d").hidden = false;
  initMap();
  document.getElementById("pSub").textContent = "Click any badge on the map.";
  wireSearch2d();
  document.getElementById("close").addEventListener("click", () => drawRoute2d(null));
  const ok = await live2d();
  if (!ok) { setMode("demo-2d"); upsert2d(DEMO); }
  else connectWS2d();
  setInterval(async () => {
    try { const s = await fetchJSON("/api/snapshot"); upsert2d(s.tracks); } catch { /* ws covers gaps */ }
  }, 15000);
})();
