# QA Final — rounds 2+3 (cycles 13–27) + release assessment (2026-09-27)

## Totals
- 15 cycles, all complete: 38/38 repo + 17/17 server every cycle (825 automated checks, 0 fail).
- Syntax 29 files clean every cycle. API contracts green every cycle. Screenshots 13/17/22/27.

## What the rounds proved
- Zoom defect fixed: wheel + custom buttons verified working 15/15 (3D height deltas measured).
- Favicon 404 (the single recurring failed request in round 2) fixed; rounds 23–27 show zero failed requests and zero JS errors.
- Feed stable at ~800 merged fallback tracks; wild swings eliminated by merge + backoff + 30s poll.
- Satellite tiles flowing (Google default), clusters + yellow planes rendering, logo theme live in screenshots.

## Residual risks (unchanged, honest)
- Primary feed still 429-throttled: global ~10k density returns on quota reset or free-account creds. Fallback is regional patches, not full globe.
- Coverage gaps unchanged: repo E2E, axe-core, real devices, perf timings, lint/typecheck.
- Google direct tiles need a Maps key for production.

## Release assessment
**Conditionally ready: deployable as a working live flight tracker.** All automated gates pass across 15 consecutive cycles; known limitations are quota/data-density (external) rather than app defects. Ship with the fallback badge visible (it is) and add `OPENSKY_USER/PASS` when available.
