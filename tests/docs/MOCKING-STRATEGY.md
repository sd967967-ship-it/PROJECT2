# Mocking Strategy — SkyTrack

## Principle
Never hit OpenSky/adsb.lol/tiles from automated tests. All external I/O is replaced at the seam:
`tests/mocks/*.js` implement the same Interface shape the app will use; fixtures in `tests/fixtures/` are the only data.

## Mocks
| Mock | File | Modes | Contract |
|------|------|-------|----------|
| Feed HTTP | `tests/mocks/feed.mock.js` | ok, empty, invalid, slow, flaky, denied(429) | serves `snapshot.json` shape `{t, states[]}` |
| WS messages | `tests/mocks/ws.mock.js` | diff, stale, malformed | builders for `{op:"diff",t,upsert,remove}` |
| Browser env | inline in tests | — | `public/app.js` never imported; static-text assertions only |

## Rules
- `USE_MOCK_API=true`, `API_BASE_URL=http://127.0.0.1:<ephemeral>` (see `tests/config/env.js`).
- Timeouts: `AbortSignal.timeout(2000)`; slow mode delays 3000ms to force timeout path.
- 429 mode: HTTP 429 + `Retry-After: 30`; client helper must back off and serve stale (see failure tests).
- No feeder keys, no prod accounts, no tile scraping in tests.
