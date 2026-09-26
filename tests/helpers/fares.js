// Test-only fare estimator mirror (LLD Pricing Module). Modeled, never real data.
const BASE_PER_KM = 0.12;
const MULT = { eco: 1, prem: 1.4, biz: 2.5, first: 4.0 };
function estimateFares(distKm, airlineIdx = 1) {
  if (typeof distKm !== "number" || Number.isNaN(distKm)) throw new TypeError("distKm number");
  if (distKm < 0) throw new RangeError("distKm>=0");
  const out = {};
  for (const [k, m] of Object.entries(MULT)) {
    const avg = Math.round(distKm * BASE_PER_KM * m * airlineIdx);
    out[k] = { avg, min: Math.round(avg * 0.8), max: Math.round(avg * 1.3), n: 0, confidence: "low/modeled" };
  }
  return out;
}
module.exports = { estimateFares, BASE_PER_KM, MULT };
