// Layer status registry: every data layer described once for the layer panel
// (GET /api/layers) and ops. States: live|delayed|cached|static|unavailable.
// Demo rows are never called live: they surface as unavailable + a note, and
// the badge reads "sample".
function ageState(updatedMs, cadenceMs) {
  const age = Date.now() - (updatedMs || 0);
  if (!updatedMs) return "unavailable";
  if (age < cadenceMs * 3) return "live";
  if (age < cadenceMs * 12) return "delayed";
  return "unavailable";
}
function snapshotState(src, states, updatedMs, cadenceMs) {
  if (src === "live") return { state: ageState(updatedMs, cadenceMs), note: null };
  if (!states || !states.length) return { state: "unavailable", note: "no data yet" };
  if (states.every((s) => s && s.src === "demo")) {
    return { state: "unavailable", note: "sample positions until the feed is configured" };
  }
  if (src === "fallback") return { state: ageState(updatedMs, cadenceMs), note: "fallback feed" };
  return { state: "unavailable", note: "feed unreachable" };
}
// defs: [{id, category, label, description, source, credit, cadenceMs,
// coverage, onDefault, kind: "snapshot"|"static"|"computed"|"ondemand",
// get: () => ({src, t, states}) | null, parked: bool, parkedNote}]
function buildLayers(defs) {
  return defs.map((d) => {
    const base = {
      id: d.id, category: d.category, label: d.label,
      description: d.description || null, source: d.source || null,
      credit: d.credit || null, cadenceMs: d.cadenceMs || null,
      coverage: d.coverage || null, onDefault: !!d.onDefault,
    };
    if (d.kind === "static") return { ...base, state: "static", updatedMs: null, note: null };
    if (d.kind === "computed") return { ...base, state: "live", updatedMs: Date.now(), note: "computed on request" };
    if (d.kind === "ondemand") {
      const last = d.last && d.last();
      if (!last || !last.t) return { ...base, state: "unavailable", updatedMs: null, note: d.parkedNote || "query on demand" };
      return { ...base, state: ageState(last.t, d.cadenceMs || 600000), updatedMs: last.t, note: last.note || "point queries" };
    }
    if (d.parked) return { ...base, state: "unavailable", updatedMs: null, note: d.parkedNote || "needs configuration" };
    try {
      const s = d.get();
      const r = snapshotState(s.src, s.states, s.t, d.cadenceMs || 60000);
      return { ...base, state: r.state, updatedMs: s.t || null, note: r.note };
    } catch {
      return { ...base, state: "unavailable", updatedMs: null, note: "feed error" };
    }
  });
}
module.exports = { buildLayers, snapshotState, ageState };
