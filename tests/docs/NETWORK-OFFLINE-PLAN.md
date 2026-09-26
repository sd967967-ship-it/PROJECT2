# Network / Offline Plan — SkyTrack

## Matrix (mock feed + devtools)
| Condition | Expectation | Where |
|-----------|-------------|-------|
| Online ok | snapshot renders, badge live/demo | integration + manual |
| 429 | backoff, stale ≤60s + "delayed" badge | `I-FAIL-01` |
| Timeout (>2s) | stale + warning, no unhandled throw | `I-FAIL-02` |
| Invalid JSON | mapped error, previous state kept | `I-FEED-03` |
| Offline (server down) | offline flag, mock retained | `I-OFF-01` |
| Slow 3G (manual) | tiles progressive, app usable | E-SLOW-01 (later) |
| Reconnect | fresh fetch, badge clears | manual checklist |

Stale-while-revalidate everywhere; callers always get `{data?, stale, warning?}` never a bare throw.
