// TrackingSource Module: one seam for every domain. Each domain source answers
// getSnapshot() -> {t, src, movers[]}; movers[] = {id, domain, kind, lat, lon,
// altM, velKmh, hdg, label, meta, src}. Callers learn one function per domain
// and get caching + failover free. See docs/LLD.md#trackingsource-module.
const DOMAINS = ["sky", "sea", "streets", "space"];
const DOMAIN_META = {
  sky: { label: "Sky", credit: "Data OpenSky + adsb.lol (ODbL)" },
  sea: { label: "Sea", credit: "Vessels: keyless AIS when configured, demo otherwise" },
  streets: { label: "Streets", credit: "Transit: demo + static stops; GTFS-RT parked" },
  space: { label: "Space", credit: "TLE: CelesTrak (courtesy) · solar: math-only" },
};
function assertDomain(domain) {
  if (!DOMAINS.includes(domain)) throw Object.assign(new Error(`unknown domain ${domain}`), { code: "DOMAIN_UNKNOWN" });
  return domain;
}
// Derive the display source: live only when the primary feed succeeded;
// demo when every row is demo (or the cache never filled); else fallback.
function deriveSrc(cacheSrc, states) {
  if (cacheSrc === "live") return "live";
  if (!states || !states.length) return "demo";
  if (states.every((s) => s && s.src === "demo")) return "demo";
  return cacheSrc === "fallback" ? "fallback" : "none";
}
function inBbox(m, b) {
  if (!b) return true;
  return m.lat >= b.lamin && m.lat <= b.lamax && m.lon >= b.lomin && m.lon <= b.lomax;
}
function createRegistry(sources) {
  for (const d of DOMAINS) {
    if (!sources[d] || typeof sources[d].getSnapshot !== "function") {
      throw new TypeError(`TrackingSource missing for domain ${d}`);
    }
  }
  return {
    domains: () => DOMAINS.map((d) => ({ id: d, ...DOMAIN_META[d] })),
    getSnapshot(domain, bbox) {
      assertDomain(domain);
      const s = sources[domain].getSnapshot();
      const movers = (s.movers || []).filter((m) => inBbox(m, bbox));
      return { t: s.t || Date.now(), src: s.src || "none", movers };
    },
  };
}
module.exports = { DOMAINS, DOMAIN_META, assertDomain, deriveSrc, createRegistry };
