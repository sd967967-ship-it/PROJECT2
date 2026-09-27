// Weather Module: Open-Meteo current conditions + air quality, TTL-cached.
// Point queries only; lat/lon validated at the route. Attribution required.
const TTL_MS = 10 * 60e3;
const cache = new Map(); // "lat,lon,units" -> {t, data}
function validatePoint(lat, lon) {
  if (lat == null || lon == null || lat === "" || lon === "") {
    throw Object.assign(new Error("bad lat/lon"), { code: "BAD_INPUT", status: 400 });
  }
  const la = Number(lat), lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) {
    throw Object.assign(new Error("bad lat/lon"), { code: "BAD_INPUT", status: 400 });
  }
  return { lat: la, lon: lo };
}
const WMO = { 0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Icy fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow", 80: "Light showers", 81: "Showers", 82: "Violent showers", 95: "Thunderstorm", 96: "Storm + hail", 99: "Storm + heavy hail" };
function normalizeWx(fx, aq, units) {
  const c = (fx && fx.current) || {};
  const a = (aq && aq.current) || {};
  return {
    temp: c.temperature_2m ?? null,
    feelsLike: c.apparent_temperature ?? null,
    humidity: c.relative_humidity_2m ?? null,
    windKmh: c.wind_speed_10m ?? null,
    windDeg: c.wind_direction_10m ?? null,
    precipMm: c.precipitation ?? null,
    summary: WMO[c.weather_code] || (c.weather_code != null ? `code ${c.weather_code}` : null),
    timeUtc: c.time || null,
    units: units === "imperial" ? "imperial" : "metric",
    aqi: a.us_aqi ?? null,
    pm25: a.pm2_5 ?? null,
    src: "open-meteo",
  };
}
async function fetchWx({ fetchJson, lat, lon, units = "metric" } = {}) {
  const p = validatePoint(lat, lon);
  const u = units === "imperial" ? "imperial" : "metric";
  const key = `${p.lat.toFixed(2)},${p.lon.toFixed(2)},${u}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.t < TTL_MS) return { ...hit.data, cached: true };
  const q = new URLSearchParams({
    latitude: String(p.lat), longitude: String(p.lon),
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m",
    wind_speed_unit: u === "imperial" ? "mph" : "kmh", temperature_unit: u === "imperial" ? "fahrenheit" : "celsius",
    timezone: "auto",
  });
  const aq = new URLSearchParams({ latitude: String(p.lat), longitude: String(p.lon), current: "us_aqi,pm2_5" });
  const [fx, air] = await Promise.all([
    fetchJson(`https://api.open-meteo.com/v1/forecast?${q}`).then((r) => r.body),
    fetchJson(`https://air-quality-api.open-meteo.com/v1/air-quality?${aq}`).then((r) => r.body).catch(() => null),
  ]);
  const data = normalizeWx(fx, air, u);
  if (cache.size > 500) cache.clear();
  cache.set(key, { t: now, data });
  return { ...data, cached: false };
}
module.exports = { fetchWx, normalizeWx, validatePoint, TTL_MS };
