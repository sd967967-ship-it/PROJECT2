// U-STATIC: contract assertions over public/ source text (no DOM, no app edits).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "..", "public", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "..", "public", "index.html"), "utf8");

test("U-STATIC-01 three base layers", () => {
  assert.match(app, /lyrs=s/);
  assert.match(app, /lyrs=y/);
  assert.match(app, /openstreetmap/);
  assert.match(app, /L\.control\.layers/);
});
test("U-STATIC-02 fully movable map", () => {
  assert.match(app, /dragging:\s*true/);
  assert.match(app, /worldCopyJump:\s*true/);
  assert.match(app, /maxBounds:\s*null/);
});
test("U-STATIC-03 detail panel IDs present", () => {
  for (const id of ["pSpeed", "pHdg", "pEta", "pRemain", "pHours", "pCap", "pRoute", "pServices", "pFares", "search", "map"]) {
    assert.ok(html.includes(`id="${id}"`) || app.includes(id), `missing ${id}`);
  }
});
test("U-STATIC-04 ws hook present, no per-tab feed fetch", () => {
  assert.match(app, /new WebSocket/);
  assert.doesNotMatch(app, /opensky-network\.org\/api/);
  assert.doesNotMatch(app, /api\.adsb\.(lol|one)/);
});
test("U-STATIC-05 no tracked secrets in public/", () => {
  assert.doesNotMatch(app, /api[_-]?key\s*[:=]\s*['"][A-Za-z0-9]{8,}/i);
  assert.doesNotMatch(app, /password\s*[:=]\s*['"][^'"]{3,}/i);
});
