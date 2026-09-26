# Error-Handling Plan — SkyTrack

Every failure maps to a typed error; UI shows text + retry, keeps last good state.

| Source | Mapped error | UI |
|--------|--------------|----|
| HTTP 429 | `FEED_RATE_LIMITED(retryAfterMs)` | "Delayed — retrying" badge |
| Timeout | `FEED_TIMEOUT(ms)` | warning + stale data |
| Invalid body | `FEED_INVALID(reason)` | error panel + retry btn |
| Offline | `FEED_OFFLINE` | offline banner |
| Unknown hex | `FLIGHT_STALE` | "stale, retry" 404-style |
| Empty result | `EMPTY` (not error) | empty-state text |

Tests assert mapping + no `undefined` renders. Fixes are out of scope for test task — report only.
