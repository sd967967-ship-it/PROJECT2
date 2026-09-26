// Shared dossier/search/ticker logic for the 3D globe (app.js) and the 2D
// fallback map (app2d.js). No map-library code here, so both paths stay identical.
const AIRLINE_NAMES = {
  AIC: ["Air India", "in"], BAW: ["British Airways", "gb"], SIA: ["Singapore Airlines", "sg"],
  UAE: ["Emirates", "ae"], DLH: ["Lufthansa", "de"], QFA: ["Qantas", "au"],
  UAL: ["United", "us"], AAL: ["American", "us"], DAL: ["Delta", "us"],
  AFR: ["Air France", "fr"], KLM: ["KLM", "nl"], THY: ["Turkish Airlines", "tr"],
  QTR: ["Qatar Airways", "qa"], ETD: ["Etihad", "ae"], CPA: ["Cathay Pacific", "hk"],
  ANA: ["ANA", "jp"], JAL: ["JAL", "jp"],
};
const DEMO = [
  { hex: "a1b2c3", callsign: "AIC302", lat: 28.1, lon: 62.5, velKmh: 880, hdg: 290, altM: 11500, origin: "DEL", dest: "LHR", type: "B788", cap: 256, fares: { eco: 412, prem: 640, biz: 1180, first: 1890 }, servicesList: ["Wi-Fi", "Meals", "2 bags", "IFE"], src: "demo", near: { iata: "DEL", city: "Delhi", distKm: 900 } },
  { hex: "d4e5f6", callsign: "BAW249", lat: 45.5, lon: -20.0, velKmh: 905, hdg: 260, altM: 11800, origin: "LHR", dest: "JFK", type: "B77W", cap: 396, fares: { eco: 388, prem: 610, biz: 1240, first: 1980 }, servicesList: ["Wi-Fi", "Meals", "1 bag", "IFE"], src: "demo", near: { iata: "LHR", city: "London", distKm: 1400 } },
  { hex: "112233", callsign: "SIA21", lat: 35.0, lon: 135.0, velKmh: 920, hdg: 90, altM: 12100, origin: "SIN", dest: "NRT", type: "A359", cap: 253, fares: { eco: 340, prem: 560, biz: 1050, first: 1720 }, servicesList: ["Wi-Fi", "Meals", "2 bags", "IFE"], src: "demo", near: { iata: "NRT", city: "Tokyo", distKm: 700 } },
];
function flag(iso) { return iso ? `https://flagcdn.com/w40/${iso}.png` : null; }
function airlineFor(f) {
  const prefix = (f.callsign || "").trim().slice(0, 3).toUpperCase();
  const hit = AIRLINE_NAMES[prefix];
  return { prefix, name: (hit && hit[0]) || null, iso: (hit && hit[1]) || f.iso || null };
}
function normalizeFares(fares) {
  if (!fares) return null;
  const out = {};
  for (const [k, v] of Object.entries(fares)) out[k] = (v && typeof v === "object") ? v : { avg: v };
  return out;
}
function setMode(mode, src) {
  document.getElementById("modeBadge").textContent = mode === "live" ? `live · ${src}` : mode;
  document.getElementById("liveDot").classList.toggle("on", mode === "live");
}
async function fetchJSON(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
function renderDossier(f) {
  const al = airlineFor(f);
  document.getElementById("pTitle").textContent = `${f.callsign || f.hex}${f.origin && f.dest ? ` · ${f.origin}→${f.dest}` : ""}`;
  document.getElementById("pSub").textContent = `${al.name || "Unknown operator"} · HEX ${f.hex}${f.type ? ` · ${f.type}` : ""}`;
  const fl = document.getElementById("pFlag");
  const fs = flag(al.iso);
  if (fs) { fl.src = fs; fl.alt = al.iso; fl.hidden = false; fl.onerror = () => (fl.hidden = true); } else fl.hidden = true;
  document.getElementById("pSpeed").textContent = f.velKmh != null ? `${f.velKmh} km/h` : "–";
  document.getElementById("pAlt").textContent = f.altM != null ? `${Math.round(f.altM).toLocaleString()} m` : "–";
  document.getElementById("pHdg").textContent = f.hdg != null ? `${Math.round(f.hdg)}°` : "–";
  document.getElementById("pVs").textContent = f.vsMs != null ? `${f.vsMs > 0 ? "+" : ""}${Number(f.vsMs).toFixed(1)} m/s` : "–";
  document.getElementById("pNear").textContent = f.near ? `${f.near.iata} · ${f.near.distKm.toLocaleString()} km` : "–";
  const cap = f.capacity ? `${f.capacity.seats} seats · typ 80–85%` : (f.cap ? `${f.cap} seats · typ 80–85%` : "–");
  document.getElementById("pCap").textContent = cap;
  document.getElementById("pRoute").textContent = f.route
    ? `${f.route.origin.iata} → ${f.route.dest.iata} · ${f.route.distKm.toLocaleString()} km · ${f.route.remainKm.toLocaleString()} km left`
    : (f.origin && f.dest ? `${f.origin} → ${f.dest}` : "Position-only track");
  const sv = f.services && !f.services.unknown
    ? [f.services.wifi && "Wi-Fi", f.services.meals && (f.services.meals === true ? "Meals" : f.services.meals), f.services.baggage, f.services.entertainment].filter(Boolean)
    : (f.servicesList || ["Wi-Fi", "Meals", "Baggage", "IFE"]);
  document.getElementById("pServices").innerHTML = sv.map((s) => `<li>${s}</li>`).join("");
  const fares = normalizeFares(f.fares);
  document.getElementById("pFares").innerHTML = fares
    ? Object.entries(fares).map(([k, v]) => `<tr><td>${k}</td><td>$${Number(v.avg ?? v).toLocaleString()} avg</td></tr>`).join("")
    : "<tr><td>route unknown</td><td>–</td></tr>";
  return al;
}
function updateTicker(list) {
  document.getElementById("count").textContent = list.length.toLocaleString();
  const top = {};
  for (const f of list) top[f.originCountry || "?"] = (top[f.originCountry || "?"] || 0) + 1;
  document.getElementById("topList").textContent = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${k} ${n.toLocaleString()}`).join(" · ");
}
