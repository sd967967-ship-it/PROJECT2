// R-Regression smoke: landing + contract integrity (see docs/REGRESSION-SUITE.md).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..", "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("R-01 landing wires Cesium app + styles", () => {
  const html = read("public/index.html");
  assert.match(html, /Cesium\.js/); assert.match(html, /widgets\.css/);
  assert.match(html, /app\.js/); assert.match(html, /styles\.css/);
});
test("R-02 map contract intact", () => {
  const app = read("public/app.js");
  assert.match(app, /UrlTemplateImageryProvider/); assert.match(app, /ScreenSpaceEventType/);
});
test("R-03 search contract intact", () => {
  const app = read("public/app.js");
  assert.match(app, /getElementById\("search"\)/); assert.match(app, /toUpperCase\(\).includes/);
});
test("R-04 detail contract intact", () => {
  const app = read("public/app.js");
  for (const id of ["pSpeed", "pNear", "pCap", "pFares"]) assert.ok(app.includes(id));
});
test("R-05 ws contract intact", () => {
  const { isValidDiff } = require("../mocks/ws.mock");
  assert.ok(isValidDiff({ op: "diff", t: 1, upsert: [], remove: [] }));
});
