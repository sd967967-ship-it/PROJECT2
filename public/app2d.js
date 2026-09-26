// SkyTrack 2D fallback map (Leaflet + Esri satellite). Used automatically when
// WebGL/Cesium is unavailable. Same data, dossier, search, and ticker as 3D via shared.js.
const state2d = { map: null, group: null, markers: new Map(), tracks: new Map(), trails: new Map(), routeLine: null, trailLine: null, all: [], layers: {}, selectedHex: null, followHex: null };
function initMap() {
  const googleSat = L.tileLayer("https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", { subdomains: ["mt0", "mt1", "mt2", "mt3"], maxZoom: 19, attribution: "Imagery © Google" });
  const googleHyb = L.tileLayer("https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", { subdomains: ["mt0", "mt1", "mt2", "mt3"], maxZoom: 19, attribution: "Imagery © Google" });
  const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Esri World Imagery" });
  const labels = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Esri" });
  const street = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" });
  const map = L.map("map2d", { worldCopyJump: true, minZoom: 2, zoomControl: false }).setView([25, 20], 2);
  window.__map2d = map; // debug/test seam
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
function planeIcon(f) {
  const hdg = ((Number(f.hdg) || 0) % 360 + 360) % 360;
  return L.divIcon({
    className: "plane-icon",
    html: `<svg viewBox="-30 -30 60 60" width="30" height="30" style="transform:rotate(${hdg}deg)"><g fill="#ffd23f" stroke="#0b2036" stroke-width="2.5"><path d="M0,-26 L5,-8 L26,4 L26,9 L5,4 L4,18 L12,22 L12,25 L0,22 L-12,25 L-12,22 L-4,18 L-5,4 L-26,9 L-26,4 L-5,-8 Z"/></g></svg>`,
    iconSize: [30, 30], iconAnchor: [15, 15],
  });
}
function pushTrail2d(f) {
  let t = state2d.trails.get(f.hex);
  if (!t) { t = []; state2d.trails.set(f.hex, t); }
  const last = t[t.length - 1];
  if (!last || Math.abs(last[0] - f.lat) > 1e-4 || Math.abs(last[1] - f.lon) > 1e-4) t.push([f.lat, f.lon]);
  if (t.length > 12) t.shift();
  if (state2d.trails.size > 1200) state2d.trails.delete(state2d.trails.keys().next().value);
}
function drawSelectedTrail2d() {
  const map = state2d.map;
  if (state2d.trailLine) { map.removeLayer(state2d.trailLine); state2d.trailLine = null; }
  const t = state2d.selectedHex && state2d.trails.get(state2d.selectedHex);
  if (!t || t.length < 2) return;
  state2d.trailLine = L.polyline(t, { color: "#ffb454", weight: 2 }).addTo(map);
}
function upsert2d(list) {
  const map = state2d.map, seen = new Set();
  if (!state2d.group) {
    state2d.group = (typeof L.markerClusterGroup === "function")
      ? L.markerClusterGroup({ maxClusterRadius: 25, disableClusteringAtZoom: 6 }).addTo(map)
      : L.layerGroup().addTo(map);
  }
  state2d.tracks = new Map();
  for (const f of list.slice(0, 800)) {
    seen.add(f.hex);
    state2d.tracks.set(f.hex, f);
    pushTrail2d(f);
    let m = state2d.markers.get(f.hex);
    if (!m) {
      m = L.marker([f.lat, f.lon], { icon: planeIcon(f), title: f.callsign || f.hex });
      m.on("click", () => show2d(f.hex));
      state2d.markers.set(f.hex, m);
      state2d.group.addLayer(m);
    } else {
      m.setLatLng([f.lat, f.lon]);
      m.setIcon(planeIcon(f));
    }
  }
  for (const [hex, m] of state2d.markers) {
    if (!seen.has(hex)) { state2d.group.removeLayer(m); state2d.markers.delete(hex); state2d.trails.delete(hex); }
  }
  state2d.all = list;
  updateTicker(list);
  drawSelectedTrail2d();
  if (state2d.followHex && state2d.tracks.has(state2d.followHex)) {
    const t = state2d.tracks.get(state2d.followHex);
    map.panTo([t.lat, t.lon], { animate: true });
  }
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
