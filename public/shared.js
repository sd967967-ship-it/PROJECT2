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
// Escape feed-derived strings before innerHTML: callsigns/labels arrive over
// radio and public feeds, so treat them as untrusted (stored-XSS surface).
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function announce(msg) {
  const el = document.getElementById("srStatus");
  if (el) el.textContent = msg;
}
// Original educational one-liners (plain facts, no copied text).
const PLANET_INFO = {
  Sun: "Star at the system's center; its apparent position drives day and night.",
  Moon: "Earth's only natural satellite; its phase comes from Sun–Earth geometry.",
  Mercury: "Smallest planet, closest to the Sun, with extreme day–night swings.",
  Venus: "Cloud-wrapped world with a runaway greenhouse effect; brightest planet.",
  Mars: "Dusty red planet hosting rovers, orbiters, and our next-visit plans.",
  Jupiter: "Largest planet; its gravity shepherds asteroids and hosts big moons.",
  Saturn: "Ringed gas giant; Titan and Enceladus are ocean-world candidates.",
  Uranus: "Ice giant tipped on its side, rolling around the Sun.",
  Neptune: "Windiest world, found by mathematics before telescopes saw it.",
  Pluto: "Dwarf planet of the Kuiper belt, visited by New Horizons in 2015.",
  Io: "Most volcanic body known, squeezed by Jupiter's tides.",
  Europa: "Icy moon with a likely subsurface ocean; prime life-search target.",
  Ganymede: "Largest moon in the system, bigger than Mercury.",
  Callisto: "Ancient cratered moon, a record of 4 billion years of impacts.",
  Titan: "Saturn's moon with lakes of liquid methane under orange haze.",
};
// Domains: one UI, four TrackingSource adapters (see docs/LLD.md). All data
// comes from same-origin /api + ws; the frontend never calls feeds directly.
const DOMAINS = {
  sky: { label: "Sky", noun: "airborne", color: "#ffd23f", credit: "Data OpenSky + adsb.lol · Imagery Esri + OSM · Flags flagcdn", detail: (id) => `/api/flights/${id}` },
  sea: { label: "Sea", noun: "afloat", color: "#57e6ff", credit: "Vessels: keyless AIS when configured, demo otherwise · Imagery Esri + OSM", detail: (id) => `/api/sea/vessels/${encodeURIComponent(id)}` },
  streets: { label: "Streets", noun: "rolling", color: "#7cfc98", credit: "Transit: demo + static stops · GTFS-RT parked · Imagery Esri + OSM", detail: (id) => `/api/streets/vehicles/${encodeURIComponent(id)}` },
  space: { label: "Space", noun: "tracked", color: "#c9a7ff", credit: "TLE: CelesTrak · solar: math-only · Imagery Esri + OSM", detail: (id) => `/api/space/objects/${encodeURIComponent(id)}` },
};
function domainOf(f) { return (f && f.domain && DOMAINS[f.domain]) ? f.domain : "sky"; }
function moverId(f) { return (f && (f.hex || f.id)) || ""; }
function moverLabel(f) { return (f && (f.label || f.callsign || f.hex || f.id)) || ""; }
function searchFields(f) {
  const m = (f && f.meta) || {};
  return `${moverLabel(f)} ${moverId(f)} ${f.origin || ""} ${f.dest || ""} ${m.route || m.dest || m.type || m.body || ""} ${m.flag || ""} ${m.status || ""} ${m.agency || ""} ${m.target || ""}`;
}
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
  document.getElementById("modeBadge").textContent = mode === "live" ? `live · ${src}` : (mode === "mixed" ? `mixed · ${src}` : mode);
  document.getElementById("liveDot").classList.toggle("on", mode === "live" || mode === "mixed");
}
function modeFor(src) { return src === "demo" ? "demo" : (src === "mixed" ? "mixed" : "live"); }
const DOMAIN_PICK = { sky: "flight", sea: "vessel", streets: "vehicle", space: "body" };
function resetDossier(domain) {
  const dom = (domain && DOMAINS[domain]) ? domain : "sky";
  document.getElementById("pTitle").textContent = `Pick a ${DOMAIN_PICK[dom]}`;
  document.getElementById("pSub").textContent = "Search above or click any badge on the globe.";
  for (const id of ["pSpeed", "pAlt", "pHdg", "pVs", "pNear", "pCap"]) document.getElementById(id).textContent = "–";
  document.getElementById("pRoute").textContent = "Position-only track";
  document.getElementById("pServices").innerHTML = "";
  document.getElementById("pFares").innerHTML = "<tr><td>route unknown</td><td>–</td></tr>";
  document.getElementById("follow").textContent = dom === "sky" ? "Follow this flight" : "Follow";
  document.getElementById("pFine").textContent = dom === "sky"
    ? "Capacity is aircraft seats plus a typical-load band, an estimate. Fares are distance-modeled until collected history lands."
    : dom === "space" ? "Satellites from CelesTrak TLE; solar subpoints from math-only ephemeris; craft markers show vicinity, not exact positions."
    : dom === "sea" ? "Vessel positions keyless-AIS when configured, demo otherwise. Never navigation-grade."
    : "Transit demo + static stops. Live vehicles park until a city feed is configured.";
}
async function fetchJSON(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
function renderDossier(f) {
  const dom = domainOf(f);
  if (dom !== "sky") return renderDomainDossier(f, dom);
  const al = airlineFor(f);
  focusDossier();
  announce(`${moverLabel(f)} details opened`);
  document.getElementById("pTitle").textContent = `${f.callsign || f.hex}${f.origin && f.dest ? ` · ${f.origin}→${f.dest}` : ""}`;
  document.getElementById("pSub").textContent = `${al.name || "Unknown operator"} · HEX ${f.hex}${f.type ? ` · ${f.type}` : ""}`;
  const fl = document.getElementById("pFlag");
  const fs = flag(al.iso);
  if (fs) { fl.src = fs; fl.alt = al.name || al.iso; fl.hidden = false; fl.onerror = () => (fl.hidden = true); } else fl.hidden = true;
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
  document.getElementById("pServices").innerHTML = sv.map((s) => `<li>${esc(s)}</li>`).join("");
  const fares = normalizeFares(f.fares);
  document.getElementById("pFares").innerHTML = fares
    ? Object.entries(fares).map(([k, v]) => `<tr><td>${esc(k)}</td><td>$${Number(v.avg ?? v).toLocaleString()} avg</td></tr>`).join("")
    : "<tr><td>route unknown</td><td>–</td></tr>";
  return al;
}
function updateTicker(list, domain) {
  const dom = (domain && DOMAINS[domain]) ? domain : "sky";
  document.getElementById("count").textContent = list.length.toLocaleString();
  const noun = document.getElementById("noun");
  if (noun) noun.textContent = DOMAINS[dom].noun;
  const top = {};
  for (const f of list) {
    const m = f.meta || {};
    const k = dom === "sea" ? (m.flag || m.type || "?") : dom === "streets" ? (m.route || m.status || "?") : dom === "space" ? (f.kind || "?") : (f.originCountry || "?");
    top[k] = (top[k] || 0) + 1;
  }
  document.getElementById("topList").textContent = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${k} ${n.toLocaleString()}`).join(" · ");
  const src = document.querySelector(".ticker .src");
  if (src) src.textContent = DOMAINS[dom].credit;
}
function focusDossier() {
  try { document.getElementById("pTitle").focus({ preventScroll: true }); } catch { /* older engine */ }
}
function renderDomainDossier(f, dom) {
  const m = f.meta || {};
  const kindName = { vessel: "Vessel", vehicle: "Transit vehicle", satellite: "Satellite", solar: "Solar body", craft: "Spacecraft", quake: "Earthquake", event: "Natural event", fireball: "Fireball", port: "Port", stop: "Transit stop" }[f.kind] || "Mover";
  focusDossier();
  announce(`${moverLabel(f)} details opened`);
  document.getElementById("pTitle").textContent = moverLabel(f);
  document.getElementById("pSub").textContent = `${kindName} · ${DOMAINS[dom] ? DOMAINS[dom].label : dom} · ID ${moverId(f)}`;
  document.getElementById("pFlag").hidden = true;
  const alt = f.kind === "satellite" && f.altM != null ? `${Math.round(f.altM / 1000).toLocaleString()} km`
    : f.kind === "solar" ? "–"
    : f.altM != null ? `${Math.round(f.altM).toLocaleString()} m` : "–";
  document.getElementById("pSpeed").textContent = f.velKmh != null ? `${Number(f.velKmh).toLocaleString()} km/h` : "–";
  document.getElementById("pAlt").textContent = alt;
  document.getElementById("pHdg").textContent = f.hdg != null ? `${Math.round(f.hdg)}°` : "–";
  document.getElementById("pVs").textContent = m.draughtM != null ? `${m.draughtM} m draught`
    : f.kind === "satellite" && m.periodMin != null ? `${m.periodMin} min period · ${m.inclDeg}° incl`
    : f.kind === "quake" && m.depthKm != null ? `${m.depthKm} km deep`
    : (m.status || m.noradId || "–");
  const near = f.near ? `${f.near.iata || ""}${f.near.city ? ` · ${f.near.city}` : ""} · ${Number(f.near.distKm || 0).toLocaleString()} km` : "–";
  document.getElementById("pNear").textContent = near;
  const cap = f.kind === "solar" && m.distKm != null ? `${m.distKm.toLocaleString()} km${m.distAu != null ? ` · ${m.distAu} AU` : ""}${m.illum != null ? ` · ${(m.illum * 100).toFixed(1)}% lit` : ""}${m.parent ? ` · orbits ${m.parent}` : ""}${m.periodD != null ? ` · ${m.periodD}d period` : ""}`
    : f.kind === "satellite" ? [m.noradId && `NORAD ${m.noradId}`, m.class && `class ${m.class}`, m.launchYear && `launched ${m.launchYear}`, m.apogeeKm != null && m.perigeeKm != null ? `${m.perigeeKm.toLocaleString()}–${m.apogeeKm.toLocaleString()} km` : null].filter(Boolean).join(" · ") || "–"
    : f.kind === "craft" ? [m.agency, m.mission, m.target && `@ ${m.target}`, m.launchYear && `launched ${m.launchYear}`, m.status].filter(Boolean).join(" · ") || "–"
    : f.kind === "quake" ? [`M${m.mag}`, m.place, m.status].filter(Boolean).join(" · ") || "–"
    : f.kind === "event" ? [(m.categories || []).join(", "), m.closed ? "closed" : "open"].filter(Boolean).join(" · ") || "–"
    : f.kind === "fireball" ? [m.dateUtc, m.energyKt != null && `${m.energyKt} kt`, m.velKms != null && `${m.velKms} km/s`].filter(Boolean).join(" · ") || "–"
    : [m.type, m.flag && `flag ${m.flag}`, m.route, m.dest && `→ ${m.dest}`, m.next && `next ${m.next}`].filter(Boolean).join(" · ") || "–";
  document.getElementById("pCap").textContent = cap;
  document.getElementById("pRoute").textContent = f.kind === "solar" ? (PLANET_INFO[m.body] || PLANET_INFO[f.label] || "Position-only track")
    : m.route ? `${m.route}${m.next ? ` → ${m.next}` : ""}${m.status ? ` · ${m.status}` : ""}`
    : m.dest ? `→ ${m.dest}` : (m.target ? `@ ${m.target}${m.status ? ` · ${m.status}` : ""} · vicinity marker` : "Position-only track");
  document.getElementById("pServices").innerHTML = [m.type, m.flag, m.status, m.body].filter(Boolean).map((s) => `<li>${esc(s)}</li>`).join("") || "<li>–</li>";
  document.getElementById("pFares").innerHTML = "<tr><td>fares</td><td>sky only</td></tr>";
  document.getElementById("pFine").textContent = f.kind === "quake" ? "USGS data: preliminary reports can revise. Informational only — not an emergency alert."
    : f.kind === "event" ? "NASA EONET open events. Check official sources for emergencies."
    : f.kind === "fireball" ? "Reported CNEOS events; times and places are approximate."
    : dom === "space" && f.kind === "solar"
    ? "Solar subpoint: where the body stands at zenith, from math-only ephemeris."
    : dom === "space" ? "Satellite propagated from CelesTrak TLE (courtesy). Demo elements when offline."
    : dom === "sea" ? "Vessel positions keyless-AIS when configured, demo otherwise. Never navigation-grade."
    : "Transit demo + static stops. Live vehicles park until a city feed is configured.";
  return null;
}
