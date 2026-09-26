// SkyTrack landing demo. Backend contract (see docs/TECHFLOW.md):
// ws {op:"sub",bbox} -> {op:"diff",t,upsert,remove}; GET /api/flights/:hex.
// Until server/ lands, render a labeled mock snapshot so UI is verifiable.
const MOCK = [
  { hex:"a1b2c3", callsign:"AIC302", lat:28.1, lon:62.5, velKmh:880, hdg:290, origin:"DEL", dest:"LHR", etaUtc:"14:20", remainKm:3200, elapsedH:4.2, totalH:8.6, type:"B788", cap:256, fares:{eco:412,prem:640,biz:1180,first:1890}, services:["Wi-Fi","Meals","2 bags","IFE"] },
  { hex:"d4e5f6", callsign:"BAW249", lat:45.5, lon:-20.0, velKmh:905, hdg:260, origin:"LHR", dest:"JFK", etaUtc:"16:05", remainKm:2400, elapsedH:3.1, totalH:6.4, type:"B77W", cap:396, fares:{eco:388,prem:610,biz:1240,first:1980}, services:["Wi-Fi","Meals","1 bag","IFE"] },
  { hex:"112233", callsign:"SIA21", lat:35.0, lon:135.0, velKmh:920, hdg:90, origin:"SIN", dest:"NRT", etaUtc:"11:45", remainKm:1800, elapsedH:2.0, totalH:5.2, type:"A359", cap:253, fares:{eco:340,prem:560,biz:1050,first:1720}, services:["Wi-Fi","Meals","2 bags","IFE"] },
  { hex:"445566", callsign:"EKR512", lat:12.0, lon:48.0, velKmh:895, hdg:300, origin:"DXB", dest:"BOM", etaUtc:"09:30", remainKm:900, elapsedH:1.2, totalH:2.6, type:"B738", cap:189, fares:{eco:210,prem:330,biz:620,first:990}, services:["Meals","1 bag","IFE"] },
  { hex:"778899", callsign:"DLH401", lat:50.0, lon:10.0, velKmh:870, hdg:270, origin:"FRA", dest:"ORD", etaUtc:"18:10", remainKm:5200, elapsedH:1.5, totalH:8.9, type:"B744", cap:416, fares:{eco:455,prem:700,biz:1380,first:2210}, services:["Wi-Fi","Meals","2 bags","IFE"] },
  { hex:"aabbcc", callsign:"QFA8", lat:-25.0, lon:150.0, velKmh:910, hdg:120, origin:"SYD", dest:"DFW", etaUtc:"22:55", remainKm:6800, elapsedH:3.8, totalH:14.2, type:"B789", cap:236, fares:{eco:620,prem:940,biz:1780,first:2850}, services:["Wi-Fi","Meals","2 bags","IFE"] },
];
const map = L.map("map", {
  dragging: true, scrollWheelZoom: true, doubleClickZoom: true,
  boxZoom: true, keyboard: true, zoomControl: true,
  worldCopyJump: true, minZoom: 2, maxBounds: null,
}).setView([25, 20], 2);
const googleSat = L.tileLayer("https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", {
  subdomains: ["mt0", "mt1", "mt2", "mt3"], maxZoom: 19,
  attribution: "Imagery © Google",
});
const googleHybrid = L.tileLayer("https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
  subdomains: ["mt0", "mt1", "mt2", "mt3"], maxZoom: 19,
  attribution: "Imagery © Google",
});
const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" });
googleSat.addTo(map);
L.control.layers({ Satellite: googleSat, Hybrid: googleHybrid, Streets: osm }).addTo(map);
const markers = new Map(); let arcs = [];
function clearArcs(){ arcs.forEach(a => map.removeLayer(a)); arcs = []; }
function arcPoints(a, b, n = 40) {
  const pts = []; const R = Math.PI / 180;
  const la1 = a[0]*R, lo1 = a[1]*R, la2 = b[0]*R, lo2 = b[1]*R;
  for (let i = 0; i <= n; i++) { const f = i/n; pts.push([la1+(la2-la1)*f, lo1+(lo2-lo1)*f].map((v,j)=> v/R)); }
  return pts;
}
const DEST = { LHR:[51.47,-0.45], JFK:[40.64,-73.78], NRT:[35.77,140.39], BOM:[19.09,72.87], ORD:[41.97,-87.91], DFW:[32.9,-97.04], DEL:[28.57,77.1], SIN:[1.36,103.99], DXB:[25.25,55.36], FRA:[50.03,8.56], SYD:[-33.95,151.18] };
function show(f) {
  document.getElementById("pTitle").textContent = `${f.callsign} · ${f.origin}→${f.dest}`;
  document.getElementById("pSub").textContent = `HEX ${f.hex} · ${f.type}`;
  document.getElementById("pSpeed").textContent = `${f.velKmh} km/h`;
  document.getElementById("pHdg").textContent = `${f.hdg}°`;
  document.getElementById("pEta").textContent = `${f.etaUtc} UTC`;
  document.getElementById("pRemain").textContent = `${f.remainKm} km`;
  document.getElementById("pHours").textContent = `${f.elapsedH}h / ${f.totalH}h`;
  document.getElementById("pCap").textContent = `${f.cap} seats · typ 80–85%`;
  document.getElementById("pRoute").textContent = `${f.origin} → ${f.dest}`;
  document.getElementById("pServices").innerHTML = f.services.map(s => `<li>${s}</li>`).join("");
  document.getElementById("pFares").innerHTML = Object.entries(f.fares).map(([k,v]) => `<tr><td>${k}</td><td>$${v} avg</td></tr>`).join("");
  clearArcs();
  const d = DEST[f.dest]; if (d) arcs.push(L.polyline(arcPoints([f.lat, f.lon], d), { color:"#4da3ff" }).addTo(map));
}
function render(list) {
  document.getElementById("count").textContent = list.length;
  list.forEach(f => {
    if (!markers.has(f.hex)) {
      const m = L.marker([f.lat, f.lon]).addTo(map).on("click", () => show(f));
      m.bindTooltip(f.callsign); markers.set(f.hex, m);
    } else markers.get(f.hex).setLatLng([f.lat, f.lon]);
  });
}
document.getElementById("search").addEventListener("input", e => {
  const q = e.target.value.trim().toUpperCase();
  if (!q) { render(MOCK); return; }
  render(MOCK.filter(f => (f.callsign + f.origin + f.dest + f.hex).toUpperCase().includes(q)));
});
// Try backend ws, else stay on labeled mock.
try {
  const ws = new WebSocket(`ws://${location.host}`);
  ws.onopen = () => { document.getElementById("modeBadge").textContent = "live"; ws.send(JSON.stringify({ op:"sub" })); };
  ws.onmessage = ev => { try { const m = JSON.parse(ev.data); if (m.upsert) render(m.upsert); } catch {} };
  ws.onerror = () => {};
} catch {}
render(MOCK); show(MOCK[0]);
