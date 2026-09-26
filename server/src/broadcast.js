// Broadcast Module: ws subscribe(bbox) -> throttled diff push. Drops, never queues, on slow clients.
const MAX_MARKERS = 800;
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
function attach(wss, poller, { pushMs = 5000 } = {}) {
  const timer = setInterval(() => {
    const snap = poller.getSnapshot();
    const msg = JSON.stringify({ op: "diff", t: snap.t, src: snap.src, upsert: null, remove: [] });
    for (const ws of wss.clients) {
      if (ws.readyState !== 1) continue;
      if (ws.bufferedAmount > 1024 * 1024) continue; // slow client: drop this tick
      const list = cull(snap.states, ws.bbox);
      ws.send(JSON.stringify({ op: "diff", t: snap.t, src: snap.src, upsert: list, remove: [] }));
    }
    void msg;
  }, pushMs);
  wss.on("connection", (ws) => {
    ws.bbox = null;
    ws.on("message", (raw) => {
      try {
        const m = JSON.parse(raw);
        if (m && m.op === "sub") ws.bbox = m.bbox || null;
      } catch { /* ignore malformed */ }
    });
    const snap = poller.getSnapshot();
    ws.send(JSON.stringify({ op: "diff", t: snap.t, src: snap.src, upsert: cull(snap.states, null), remove: [] }));
  });
  return () => clearInterval(timer);
}
module.exports = { attach, cull, MAX_MARKERS };
