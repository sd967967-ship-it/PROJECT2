# Tech Flow — Live map + detail

1. Browser opens `/` → Cesium globe init (Esri satellite), `ws` connect to same origin.
2. Client sends `{op:"sub", bbox:{lamin,lomin,lamax,lomax}}` on move (debounced 500ms).
3. `Broadcast Module` culls cached `TrackedFlight[]` to bbox, caps 1200, replies `{op:"diff", t, upsert, remove}` every 5s.
4. Client reconciles billboard entities (canvas airline badges); click entity → `GET /api/flights/:hex` (served from cache, ≤500ms).
5. `GET /api/flights/:hex` payload: `TrackedFlight` + `capacity` (see LLD.md#capacity-module) + `fares` (see LLD.md#pricing-module) + `services` + great-circle arc points.
6. Background every 10s: `poller.js` → OpenSky (fallback adsb.lol) → `fuse()` → refresh cache. Browsers never call feeds directly.

## Failure modes
| Failure | Behavior |
|---------|----------|
| Feed 429 | serve stale ≤60s, backoff 30s, log; UI shows "delayed" badge |
| Empty route | detail shows position-only + speed/alt/hdg, ETA blank (not zero) |
| Slow ws client | drop to latest snapshot (no queue growth) |
| Hex not in cache | `404 {error:"stale, retry"}` |

## Related LLD sections
LLD.md#ingestion-module, LLD.md#fusion-module, LLD.md#broadcast-module.
