// Test-only reference geo math mirroring LLD contracts (not app code).
function haversineKm(a, b) {
  const R = 6371, d = Math.PI / 180;
  const la1 = a[0] * d, lo1 = a[1] * d, la2 = b[0] * d, lo2 = b[1] * d;
  const s1 = Math.sin((la2 - la1) / 2), s2 = Math.sin((lo2 - lo1) / 2);
  const h = s1 * s1 + Math.cos(la1) * Math.cos(la2) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(Math.max(0, h))));
}
function arcPoints(a, b, n = 40) {
  if (!Number.isFinite(n) || n < 1) throw new RangeError("n>=1");
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    pts.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return pts;
}
module.exports = { haversineKm, arcPoints };
