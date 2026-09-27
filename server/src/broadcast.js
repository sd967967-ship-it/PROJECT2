// Broadcast Module: ws subscribe({domain, bbox}) -> throttled diff push.
// Drops, never queues, on slow clients. Providers answer getSnapshotFor(domain)
// or the legacy getSnapshot() (sky). See TECHFLOW.md.
const MAX_MARKERS = 1200;
const DOMAINS = ["sky", "sea", "streets", "space"];
function inBbox(f, b) {
  if (!b) return true;
  return f.lat >= b.lamin && f.lat <= b.lamax && f.lon >= b.lomin && f.lon <= b.lomax;
}
function cull(tracks, bbox, cap = MAX_MARKERS) {
  const out = [];
  for (const t of tracks) {
    if (inBbox(t, bbox)) { out.push(t); if (out.length >= cap) break; }
  }
  return out;
}
function snapshotFor(provider, domain) {
  const d = DOMAINS.includes(domain) ? domain : "sky";
  if (provider && typeof provider.getSnapshotFor === "function") return { domain: d, snap: provider.getSnapshotFor(d) };
  const snap = provider.getSnapshot();
  return { domain: "sky", snap: { t: snap.t, src: snap.src, states: snap.states || snap.tracks || [] } };
}
function attach(wss, provider, { pushMs = 5000 } = {}) {
  const timer = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.readyState !== 1) continue;
      if (ws.bufferedAmount > 1024 * 1024) continue; // slow client: drop this tick
      const { snap } = snapshotFor(provider, ws.domain);
      ws.send(JSON.stringify({ op: "diff", t: snap.t, src: snap.src, upsert: cull(snap.states, ws.bbox), remove: [] }));
    }
  }, pushMs);
  wss.on("connection", (ws) => {
    ws.bbox = null; ws.domain = "sky";
    ws.on("message", (raw) => {
      try {
        const m = JSON.parse(raw);
        if (m && m.op === "sub") {
          if (typeof m.domain === "string" && DOMAINS.includes(m.domain)) ws.domain = m.domain;
          ws.bbox = m.bbox || null;
          const { snap } = snapshotFor(provider, ws.domain);
          if (ws.readyState === 1) ws.send(JSON.stringify({ op: "diff", t: snap.t, src: snap.src, upsert: cull(snap.states, ws.bbox), remove: [] }));
        }
      } catch { /* ignore malformed */ }
    });
    const { snap } = snapshotFor(provider, ws.domain);
    ws.send(JSON.stringify({ op: "diff", t: snap.t, src: snap.src, upsert: cull(snap.states, null), remove: [] }));
  });
  return () => clearInterval(timer);
}
module.exports = { attach, cull, MAX_MARKERS, DOMAINS };
