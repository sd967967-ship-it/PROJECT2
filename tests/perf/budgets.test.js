const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("PERF-01 app.js under 25KB budget", () => {
  const n = fs.statSync(path.join(__dirname, "..", "..", "public", "app.js")).size;
  assert.ok(n < 25 * 1024, `app.js ${n} bytes`);
});
test("PERF-02 no synchronous heavy loops at load", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "..", "public", "app.js"), "utf8");
  assert.doesNotMatch(src, /while\s*\(\s*true/);
});
