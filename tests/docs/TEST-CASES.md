# Test Cases — SkyTrack (index; details live with each suite)

## Unit (`tests/unit/`)
- U-GEO-01 haversine DEL→LHR ≈ 6710km ±100 | U-GEO-02 arc point count/endpoints | U-GEO-03 antipodal clamp (no NaN)
- U-FARE-01 estimator per-class math | U-FARE-02 0km → zeros | U-FARE-03 negative throws | U-FARE-04 confidence labeled modeled
- U-CAP-01 known type | U-CAP-02 unknown → category fallback + low confidence
- U-STATIC-01 layers Satellite/Hybrid/Streets | U-STATIC-02 dragging+worldCopyJump | U-STATIC-03 detail IDs present | U-STATIC-04 ws hook w/o direct feed fetch | U-STATIC-05 no secrets in `public/`

## Integration (`tests/integration/`)
- I-FEED-01 ok snapshot → normalized tracks | I-FEED-02 empty → empty-state flag | I-FEED-03 invalid JSON → mapped error
- I-FAIL-01 429 → backoff + stale served | I-FAIL-02 slow → timeout → stale + warning | I-FAIL-03 flaky → retry-once then error
- I-OFF-01 connection refused → offline flag, no throw to caller without context

## E2E (`tests/e2e/`, Playwright later)
- E-APP-01 launch → map tiles + ≥1 marker | E-SEARCH-01 filter by callsign | E-DETAIL-01 click → panel fields | E-EMPTY-01 no-match search state
- E-ERR-01 backend down → demo badge + retry | E-RESP-01 360×640 layout intact | E-SLOW-01 3G: first paint budget logged

## Cross-cutting
- A11y: lang, names, focus, contrast, targets, announcements (`tests/docs/ACCESSIBILITY-PLAN.md`).
- Perf: startup/map/detail budgets (`tests/docs/PERFORMANCE-PLAN.md`).
- Security: secrets, injection, abuse controls (`tests/docs/SECURITY-PRIVACY-CHECKLIST.md`).
- Visual: layer/marker/panel screenshot matrix (`tests/docs/VISUAL-REGRESSION-PLAN.md`).
- Regression: core smoke each cycle (`tests/docs/REGRESSION-SUITE.md`).
