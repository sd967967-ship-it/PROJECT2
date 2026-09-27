// Solar Module: math-only subpoints for the Sun, Moon, and 8 planets.
// A subpoint (lat = declination, lon = GMST − RA) is where the body stands at
// zenith — real astronomy on the same globe UI, zero network. Elements are the
// JPL approximate set (J2000 + rate/century); the Moon uses a compact
// low-precision lunar theory. All angles in degrees unless noted.
const AU_KM = 149597870.7;
const EARTH_R_KM = 6378.14;
const OBLIQUITY = 23.43928;
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
function wrap360(d) { return ((d % 360) + 360) % 360; }
function wrap180(d) { const w = wrap360(d); return w > 180 ? w - 360 : w; }
function julian(date) { return date.getTime() / 86400000 + 2440587.5; }
function gmstDeg(date) {
  const jd = julian(date);
  const T = (jd - 2451545.0) / 36525;
  return wrap360(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - (T * T * T) / 38710000);
}
function keplerE(M, e) {
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return E;
}
// [a, e, I, L, lp, om, da, de, dI, dL, dlp, dom]
const ELEMENTS = {
  mercury: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593, 0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  venus: [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255, 0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418],
  earth: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0, 0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
  mars: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891, 0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  jupiter: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909, -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  saturn: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448, -0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
  uranus: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.96427630, 74.01692503, -0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589],
  neptune: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574, 0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664],
};
function helioAu(name, T) {
  const el = ELEMENTS[name];
  const a = el[0] + el[6] * T, e = el[1] + el[7] * T;
  const I = (el[2] + el[8] * T) * D2R;
  const L = el[3] + el[9] * T, lp = el[4] + el[10] * T, om = (el[5] + el[11] * T) * D2R;
  const M = wrap360(L - lp) * D2R, w = wrap360(lp - (el[5] + el[11] * T)) * D2R;
  const E = keplerE(M, e);
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yp, xp), r = Math.hypot(xp, yp);
  const cw = Math.cos(v + w), sw = Math.sin(v + w);
  return [
    r * (Math.cos(om) * cw - Math.sin(om) * sw * Math.cos(I)),
    r * (Math.sin(om) * cw + Math.cos(om) * sw * Math.cos(I)),
    r * (sw * Math.sin(I)),
  ];
}
// Geocentric ecliptic AU -> equatorial RA/Dec -> terrestrial subpoint.
function subpoint(gx, gy, gz, gmst) {
  const ce = Math.cos(OBLIQUITY * D2R), se = Math.sin(OBLIQUITY * D2R);
  const xe = gx, ye = gy * ce - gz * se, ze = gy * se + gz * ce;
  const r = Math.hypot(xe, ye, ze);
  const ra = wrap360(Math.atan2(ye, xe) * R2D);
  const dec = Math.asin(Math.max(-1, Math.min(1, ze / r))) * R2D;
  return { lat: dec, lon: wrap180(gmst - ra), distAu: r };
}
function moonGeo(date) {
  const d = julian(date) - 2451543.5;
  const N = (125.1228 - 0.0529538083 * d) * D2R;
  const i = 5.1454 * D2R;
  const w = (318.0634 + 0.1643573223 * d) * D2R;
  const a = 60.2666, e = 0.0549;
  const M = wrap360(115.3654 + 13.0649929509 * d) * D2R;
  const E = keplerE(M, e);
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yp, xp);
  let r = Math.hypot(xp, yp);
  const cw = Math.cos(v + w), sw = Math.sin(v + w);
  let xh = r * (Math.cos(N) * cw - Math.sin(N) * sw * Math.cos(i));
  let yh = r * (Math.sin(N) * cw + Math.cos(N) * sw * Math.cos(i));
  let zh = r * (sw * Math.sin(i));
  // Major periodic terms (Schlyter): Ms sun anomaly, Mm moon anomaly,
  // D mean elongation, F argument of latitude.
  const Ms = wrap360(356.0470 + 0.9856002585 * d);
  const Mm = wrap360(M * R2D);
  const Lm = wrap360(N * R2D + w * R2D + Mm);
  const ws = 282.9404 + 4.70935e-5 * d;
  const Ls = wrap360(Ms + ws);
  const D = wrap360(Lm - Ls);
  const F = wrap360(Lm - N * R2D);
  const s = (x) => Math.sin(x * D2R), c = (x) => Math.cos(x * D2R);
  let lon = wrap360(Math.atan2(yh, xh) * R2D)
    + (-1.274 * s(Mm - 2 * D) + 0.658 * s(2 * D) - 0.186 * s(Ms) - 0.059 * s(2 * Mm - 2 * D) - 0.057 * s(Mm - 2 * D + Ms));
  let lat = Math.asin(Math.max(-1, Math.min(1, zh / r))) * R2D
    + (-0.173 * s(F - 2 * D) - 0.055 * s(Mm - F - 2 * D) - 0.046 * s(Mm + F - 2 * D) + 0.033 * s(F + 2 * D) + 0.017 * s(2 * Mm + F));
  r += -0.58 * c(Mm - 2 * D) - 0.46 * c(2 * D);
  lon *= D2R; lat *= D2R;
  xh = r * Math.cos(lat) * Math.cos(lon); yh = r * Math.cos(lat) * Math.sin(lon); zh = r * Math.sin(lat);
  return { x: xh * EARTH_R_KM / AU_KM, y: yh * EARTH_R_KM / AU_KM, z: zh * EARTH_R_KM / AU_KM, elongDeg: D };
}
function getSolarBodies(date = new Date()) {
  const T = (julian(date) - 2451545.0) / 36525;
  const gmst = gmstDeg(date);
  const earth = helioAu("earth", T);
  const out = [];
  const push = (id, label, g, distKm, extra) => {
    const sp = subpoint(g[0], g[1], g[2], gmst);
    out.push({
      id, domain: "space", kind: "solar", lat: sp.lat, lon: sp.lon,
      altM: null, velKmh: null, hdg: null, label,
      meta: { body: label, distKm: Math.round(distKm), distAu: +(sp.distAu).toFixed(4), ...(extra || {}) },
      src: "solar",
    });
  };
  const re = Math.hypot(...earth);
  push("solar-sun", "Sun", [-earth[0], -earth[1], -earth[2]], re * AU_KM);
  const moon = moonGeo(date);
  const rm = Math.hypot(moon.x, moon.y, moon.z);
  push("solar-moon", "Moon", [moon.x, moon.y, moon.z], rm * AU_KM, {
    illum: +((1 - Math.cos(moon.elongDeg * D2R)) / 2).toFixed(3),
  });
  for (const name of ["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune"]) {
    const p = helioAu(name, T);
    const g = [p[0] - earth[0], p[1] - earth[1], p[2] - earth[2]];
    const label = name[0].toUpperCase() + name.slice(1);
    push(`solar-${name}`, label, g, Math.hypot(...g) * AU_KM);
  }
  return out;
}
module.exports = { getSolarBodies, gmstDeg, julian, AU_KM };
