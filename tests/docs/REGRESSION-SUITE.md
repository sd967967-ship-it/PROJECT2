# Regression Suite — SkyTrack

Run every cycle after any app change. `tests/regression/coreFlows.test.js` (runnable now, static+fixture level):

- R-01 landing loads: `index.html` refs Cesium JS/CSS, `app.js`, `styles.css`.
- R-02 map contract: 3 base layers + dragging + worldCopyJump intact.
- R-03 search contract: input handler + case-insensitive filter path present.
- R-04 detail contract: all panel IDs + capacity/fares rendering paths present.
- R-05 feed contract: ws `sub/diff` shape builders still match TECHFLOW.
- R-06 no-regress: no secrets, no per-tab feed fetch introduced.

Backend regression (when `server/` exists): snapshot→detail golden fixtures in `tests/fixtures/flights.json` must byte-match after `fuse()`.
