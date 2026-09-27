// SkyTrack 2D fallback map (Leaflet + Esri satellite). Used automatically when
// WebGL/Cesium is unavailable. Same data, dossier, search, and ticker as 3D via shared.js.
const state2d = { map: null, domain: "sky", ws: null, group: null, markers: new Map(), tracks: new Map(), trails: new Map(), routeLine: null, trailLine: null, all: [], layers: {}, selectedHex: null, followHex: null };
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
// Non-sky movers get compact color-coded SVG glyphs sharing the plane rotation trick.
function glyphIcon(f) {
  const color = (DOMAINS[state2d.domain] || DOMAINS.sky).color;
  const hdg = ((Number(f.hdg) || 0) % 360 + 360) % 360;
  const inner = f.kind === "vessel"
    ? `<g transform="rotate(${hdg})" fill="${color}" stroke="#0b2036" stroke-width="2.5"><path d="M0,-26 L10,10 L6,24 L-6,24 L-10,10 Z"/></g>`
    : f.kind === "vehicle"
    ? `<g fill="${color}" stroke="#0b2036" stroke-width="2.5"><rect x="-9" y="-15" width="18" height="30" rx="4"/><rect x="-6" y="-11" width="12" height="6" fill="#0b2036" stroke="none"/></g>`
    : f.kind === "satellite"
    ? `<g fill="${color}" stroke="#0b2036" stroke-width="2.5"><rect x="-13" y="-4" width="8" height="8"/><rect x="5" y="-4" width="8" height="8"/><rect x="-4" y="-4" width="8" height="8" transform="rotate(45)"/></g>`
    : `<g fill="${color}" stroke="#0b2036" stroke-width="2.5"><circle r="10"/><circle r="16" fill="none"/></g>`;
  return L.divIcon({
    className: "plane-icon",
    html: `<svg viewBox="-30 -30 60 60" width="30" height="30">${inner}</svg>`,
    iconSize: [30, 30], iconAnchor: [15, 15],
  });
}
function iconFor2d(f) { return (f.kind || "flight") === "flight" ? planeIcon(f) : glyphIcon(f); }
function snapshotUrl2d() { return state2d.domain === "sky" ? "/api/snapshot" : `/api/${state2d.domain}/snapshot`; }
function detailUrl2d(id) { return DOMAINS[state2d.domain].detail(id); }
function sendSub2d() {
  try { if (state2d.ws && state2d.ws.readyState === 1) state2d.ws.send(JSON.stringify({ op: "sub", domain: state2d.domain })); } catch { /* reconnect covers */ }
}
function setDomain2d(d) {
  if (!DOMAINS[d] || d === state2d.domain) return;
  state2d.domain = d;
  document.querySelectorAll(".modes button").forEach((b) => {
    const on = b.dataset.domain === d;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  for (const [, m] of state2d.markers) state2d.group.removeLayer(m);
  state2d.markers.clear();
  state2d.selectedHex = null; state2d.followHex = null;
  sendSub2d();
  live2d();
}
function wireModes2d() {
  document.querySelectorAll(".modes button").forEach((b) => b.addEventListener("click", () => setDomain2d(b.dataset.domain)));
}
function pushTrail2d(f) {
  const id = moverId(f);
  let t = state2d.trails.get(id);
  if (!t) { t = []; state2d.trails.set(id, t); }
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
  for (const f of list.slice(0, 1200)) {
    if (!f.hex) f.hex = f.id; // movers key on id; sky tracks on hex
    seen.add(f.hex);
    state2d.tracks.set(f.hex, f);
    pushTrail2d(f);
    let m = state2d.markers.get(f.hex);
    if (!m) {
      m = L.marker([f.lat, f.lon], { icon: iconFor2d(f), title: moverLabel(f) });
      m.on("click", () => show2d(f.hex));
      state2d.markers.set(f.hex, m);
      state2d.group.addLayer(m);
    } else {
      m.setLatLng([f.lat, f.lon]);
      m.setIcon(iconFor2d(f));
    }
  }
  for (const [hex, m] of state2d.markers) {
    if (!seen.has(hex)) { state2d.group.removeLayer(m); state2d.markers.delete(hex); state2d.trails.delete(hex); }
  }
  state2d.all = list;
  updateTicker(list, state2d.domain);
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
    const d = await fetchJSON(detailUrl2d(hex));
    f = d.flight || d.vessel || d.vehicle || d.object; setMode("live", d.src);
  } catch {
    f = state2d.all.find((x) => moverId(x) === hex);
    if (!f) return;
  }
  renderDossier(f);
  state2d.selectedHex = hex;
  drawRoute2d(f.route && f.route.arc);
  drawSelectedTrail2d();
  document.getElementById("follow").classList.toggle("on", state2d.followHex === hex);
  const t = state2d.tracks && state2d.tracks.get(hex);
  if (t) state2d.map.flyTo([t.lat, t.lon], Math.max(state2d.map.getZoom(), 5), { duration: 1.2 });
}
function wireSearch2d() {
  const box = document.getElementById("search"), out = document.getElementById("results");
  box.addEventListener("input", () => {
    const q = box.value.trim().toUpperCase();
    const list = (q ? state2d.all.filter((f) => searchFields(f).toUpperCase().includes(q)) : []).slice(0, 8);
    out.innerHTML = list.map((f) => {
      const al = airlineFor(f);
      return `<li data-id="${moverId(f)}">${al.iso ? `<img src="${flag(al.iso)}" alt="" loading="lazy" />` : ""}<span>${moverLabel(f)}</span></li>`;
    }).join("");
    out.querySelectorAll("li").forEach((li) => li.addEventListener("click", () => show2d(li.dataset.id)));
  });
}
async function live2d() {
  try {
    const s = await fetchJSON(snapshotUrl2d());
    setMode(s.src === "demo" ? "demo-2d" : "live-2d", `${DOMAINS[state2d.domain].label} · ${s.src}`);
    upsert2d(s.tracks || s.movers || []);
    return true;
  } catch { return false; }
}
function connectWS2d() {
  let ws = null;
  try { ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`); } catch { return; }
  state2d.ws = ws;
  ws.onopen = () => sendSub2d();
  ws.onmessage = (ev) => {
    try { const m = JSON.parse(ev.data); if (m.op === "diff" && m.upsert) { setMode(m.src === "demo" ? "demo-2d" : "live-2d", `${DOMAINS[state2d.domain].label} · ${m.src}`); upsert2d(m.upsert); } } catch { /* keep last frame */ }
  };
  ws.onclose = () => { state2d.ws = null; setTimeout(connectWS2d, 5000); };
}
async function loadAirports2d() {
  try {
    const d = await fetchJSON("/api/airports");
    for (const a of d.airports || []) {
      L.circleMarker([a.lat, a.lon], { radius: 5, color: "#57e6ff", weight: 2, fillOpacity: 0.6 })
        .addTo(state2d.map)
        .bindTooltip(`${a.iata} · ${a.city} · ${a.nearby || 0} nearby`)
        .on("click", () => state2d.map.setView([a.lat, a.lon], 7));
    }
  } catch { /* decoration only */ }
}
(async function boot2d() {
  document.getElementById("globe").hidden = true;
  document.getElementById("map2d").hidden = false;
  initMap();
  document.getElementById("pSub").textContent = "Click any badge on the map.";
  wireSearch2d();
  wireModes2d();
  document.getElementById("close").addEventListener("click", () => { drawRoute2d(null); state2d.selectedHex = null; drawSelectedTrail2d(); });
  document.getElementById("follow").addEventListener("click", () => {
    state2d.followHex = (state2d.followHex && state2d.followHex === state2d.selectedHex) ? null : state2d.selectedHex;
    document.getElementById("follow").classList.toggle("on", !!state2d.followHex);
  });
  document.getElementById("zin").addEventListener("click", () => state2d.map.zoomIn());
  document.getElementById("zout").addEventListener("click", () => state2d.map.zoomOut());
  loadAirports2d();
  const ok = await live2d();
  if (!ok) { setMode("demo-2d"); upsert2d(DEMO); }
  else connectWS2d();
  setInterval(async () => {
    try { const s = await fetchJSON(snapshotUrl2d()); upsert2d(s.tracks || s.movers || []); } catch { /* ws covers gaps */ }
  }, 15000);
})();
