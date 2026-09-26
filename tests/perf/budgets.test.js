const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("PERF-01 frontend JS under budget", () => {
  const dir = path.join(__dirname, "..", "..", "public");
  const total = ["app.js", "app2d.js", "shared.js"].reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);
  assert.ok(total < 60 * 1024, `frontend js ${total} bytes`);
});
test("PERF-02 no synchronous heavy loops at load", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "..", "public", "app.js"), "utf8");
  assert.doesNotMatch(src, /while\s*\(\s*true/);
});
