// U-STATIC: contract assertions over public/ source text (no DOM, no app edits).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "..", "public", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "..", "public", "index.html"), "utf8");

test("U-STATIC-01 three imagery layers (sat/hybrid/street)", () => {
  assert.match(app, /World_Imagery/);
  assert.match(app, /World_Boundaries_and_Places/);
  assert.match(app, /openstreetmap/);
  assert.match(html, /data-lyr="sat"/);
  assert.match(html, /data-lyr="hybrid"/);
  assert.match(html, /data-lyr="street"/);
});
test("U-STATIC-02 free 3D globe, render-on-demand", () => {
  assert.match(app, /new Cesium\.Viewer/);
  assert.match(app, /requestRenderMode/);
  assert.match(app, /LEFT_CLICK/);
});
test("U-STATIC-03 detail panel IDs present", () => {
  for (const id of ["pSpeed", "pAlt", "pHdg", "pVs", "pNear", "pCap", "pRoute", "pServices", "pFares", "pFlag", "search", "results", "globe"]) {
    assert.ok(html.includes(`id="${id}"`) || app.includes(id), `missing ${id}`);
  }
});
test("U-STATIC-04 backend hook present, no per-tab feed fetch", () => {
  assert.match(app, /\/api\/snapshot/);
  assert.match(app, /new WebSocket/);
  assert.doesNotMatch(app, /opensky-network\.org\/api/);
  assert.doesNotMatch(app, /api\.adsb\.(lol|one)/);
});
test("U-STATIC-05 no tracked secrets in public/", () => {
  assert.doesNotMatch(app, /api[_-]?key\s*[:=]\s*['"][A-Za-z0-9]{8,}/i);
  assert.doesNotMatch(app, /password\s*[:=]\s*['"][^'"]{3,}/i);
});
