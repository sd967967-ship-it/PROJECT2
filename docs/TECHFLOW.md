# Tech Flow — Live map + detail

1. Browser opens `/` → globe init (Google satellite default), mode Sky, `ws` connect to same origin.
2. Client sends `{op:"sub", bbox:{lamin,lomin,lamax,lomax}}` on move (debounced 500ms).
3. `Broadcast Module` culls cached records to bbox, caps 1200, replies `{op:"diff", t, upsert, remove}` every 5s.
4. Client reconciles markers (yellow planes / clusters); click → `GET /api/flights/:hex` (served from cache, ≤500ms).
5. `GET /api/flights/:hex` payload: record + capacity (see LLD.md#capacity-module) + fares (see LLD.md#pricing-module) + services + great-circle arc points.
6. Background every 30s (`POLL_MS`): `poller.js` → OpenSky (fallback: adsb.lol 43-cell sweep into 5min registry; 429 → exponential backoff to 10min, sweep continues) → `fuse()` → refresh cache. Browsers never call feeds directly.
7. Mode switch (Sky/Sea/Streets/Space): client swaps `TrackingSource` domain over the same `ws` contract; dossier/search/ticker unchanged. Space mode serves TLE-propagated satellites + math-only solar scene.

## Failure modes
| Failure | Behavior |
|---------|----------|
| Feed 429 | serve registry/stale, backoff primary up to 10min while keyless sweep continues; UI shows source badge |
| Empty route | detail shows position-only + speed/alt/hdg, ETA blank (not zero) |
| Slow ws client | drop to latest snapshot (no queue growth) |
| Hex not in cache | `404 {error:"stale, retry"}` |

## Related LLD sections
LLD.md#ingestion-module, LLD.md#fusion-module, LLD.md#broadcast-module, LLD.md#tracking-source-module.
