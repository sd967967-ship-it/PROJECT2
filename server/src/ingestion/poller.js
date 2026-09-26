// Poller: single global loop. Dependencies accepted, never created (test seam).
class Poller {
  constructor({ fetchPrimary, fetchFallback, intervalMs = 30000, staleServeMs = 60000, maxBackoffMs = 600000 } = {}) {
    if (typeof fetchPrimary !== "function") throw new TypeError("fetchPrimary required");
    this.fetchPrimary = fetchPrimary;
    this.fetchFallback = fetchFallback || null;
    this.intervalMs = intervalMs;
    this.staleServeMs = staleServeMs;
    this.maxBackoffMs = maxBackoffMs;
    this.backoffUntil = 0;
    this.backoffMs = 0;
    this.cache = { t: 0, states: [], src: "none" };
    this.consecFails = 0;
    this.hubIdx = 0;
    this.timer = null;
    this.firstSeen = new Map(); // hex -> epochMs, for tracked duration
  }
  getSnapshot() { return this.cache; }
  healthy() { return this.consecFails === 0; }
  trackedMin(hex) {
    const f = this.firstSeen.get(hex);
    return f ? (Date.now() - f) / 60000 : 0;
  }
  async cycle() {
    if (this.running) return this.cache; // slow fallback must not stack cycles
    const now = Date.now();
    const quiet = now < this.backoffUntil; // rate-limited: skip primary, sweep may continue
    this.running = true;
    try {
      if (!quiet) {
        try {
          const states = await this.fetchPrimary();
          this.consecFails = 0;
          this.backoffMs = 0;
          this.backoffUntil = 0;
          this.store(now, states, "live");
          return this.cache;
        } catch (e) {
          this.consecFails++;
          if (e && e.code === "FEED_RATE_LIMITED") {
            this.backoffMs = Math.min(this.backoffMs ? this.backoffMs * 2 : 60000, this.maxBackoffMs);
            this.backoffUntil = now + this.backoffMs;
          }
        }
      }
      if (this.fetchFallback && (quiet || this.consecFails >= 2)) {
        try {
          const states = await this.fetchFallback();
          this.store(now, states, "fallback");
          return this.cache;
        } catch { /* fall through to stale */ }
      }
      if (now - this.cache.t > this.staleServeMs) this.cache = { ...this.cache, stale: true };
      return this.cache;
    } finally {
      this.running = false;
    }
  }
  store(now, states, src) {
    for (const s of states) if (!this.firstSeen.has(s.hex)) this.firstSeen.set(s.hex, now);
    if (this.firstSeen.size > 5000) {
      const live = new Set(states.map((s) => s.hex));
      for (const k of this.firstSeen.keys()) if (!live.has(k)) this.firstSeen.delete(k);
    }
    this.cache = { t: now, states, src };
  }
  start() {
    if (this.timer) return;
    this.cycle();
    this.timer = setInterval(() => this.cycle(), this.intervalMs);
  }
  stop() { clearInterval(this.timer); this.timer = null; }
}
module.exports = { Poller };
