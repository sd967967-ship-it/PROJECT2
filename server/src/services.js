// Services Module: ICAO airline prefix -> identity + cabin services.
const AIRLINES = require("../data/airlines.json");
function airlineOf(callsign) {
  const prefix = String(callsign || "").trim().slice(0, 3).toUpperCase();
  return AIRLINES[prefix] ? { code: prefix, ...AIRLINES[prefix] } : null;
}
function getServices(callsign) {
  const al = airlineOf(callsign);
  if (!al) return { unknown: true };
  return { wifi: al.wifi, meals: al.meals, baggage: al.baggage, entertainment: al.ife };
}
module.exports = { airlineOf, getServices };
