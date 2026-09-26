// Pricing Module: modeled estimator Adapter. Confidence always low/modeled until collector lands.
const BASE_PER_KM = 0.12;
const MULT = { eco: 1, prem: 1.4, biz: 2.5, first: 4.0 };
const AIRLINE_IDX = { default: 1, premium: 1.15, lowcost: 0.85 };
function estimateFares(distKm, tier = "default") {
  if (typeof distKm !== "number" || Number.isNaN(distKm)) throw new TypeError("distKm number");
  if (distKm < 0) throw new RangeError("distKm>=0");
  const idx = AIRLINE_IDX[tier] || 1;
  const out = {};
  for (const [k, m] of Object.entries(MULT)) {
    const avg = Math.round(distKm * BASE_PER_KM * m * idx);
    out[k] = { avg, min: Math.round(avg * 0.8), max: Math.round(avg * 1.3), n: 0, confidence: "low/modeled" };
  }
  return out;
}
module.exports = { estimateFares, BASE_PER_KM, MULT };
