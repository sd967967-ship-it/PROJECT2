// ETA internals: null-safe, never fabricates precision.
function etaFor(distKm, velKmh) {
  if (distKm == null || !Number.isFinite(velKmh) || velKmh <= 0) return { remainH: null, etaUtc: null };
  const remainH = distKm / velKmh;
  return { remainH: Math.round(remainH * 10) / 10, etaUtc: new Date(Date.now() + remainH * 360e4).toISOString().slice(11, 16) };
}
module.exports = { etaFor };
