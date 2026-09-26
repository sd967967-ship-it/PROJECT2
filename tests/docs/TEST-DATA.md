# Test Data — SkyTrack

All fixtures are synthetic, hand-made, committed. No prod/real-user data.

| File | Purpose |
|------|---------|
| `tests/fixtures/snapshot.json` | mock feed `{t, states[]}` (OpenSky-like + adsb.lol-like rows) |
| `tests/fixtures/flights.json` | 3 expected `TrackedFlight` records derived from snapshot |
| `tests/fixtures/capacity.json` | `{B788:256, B77W:396, A359:253}` + fallback rule doc |
| `tests/fixtures/services.json` | 2 airlines → wifi/meals/baggage/IFE |
| `tests/fixtures/fares.json` | estimator spot-checks (distKm → class avgs) |
| `tests/fixtures/airports.json` | 6 ICAO → lat/lon for route-arc checks |

Regeneration: edit by hand only; keep counts tiny (≤6 rows) so failures stay readable.
