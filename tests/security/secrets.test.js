const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execSync } = require("node:child_process");

function trackedFiles() {
  return execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
}
test("SEC-01 no secret values in tracked public/tests/docs", () => {
  const files = trackedFiles().filter((f) => /^(public|tests|docs)\//.test(f));
  assert.ok(files.length > 0);
  const hit = [];
  for (const f of files) {
    let txt = "";
    try { txt = execSync(`git show HEAD:${f}`, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }); }
    catch { continue; }
    if (/password\s*[:=]\s*['"][^'"]{3,}['"]/i.test(txt)) hit.push(`${f}:password`);
    if (/api[_-]?key\s*[:=]\s*['"][A-Za-z0-9]{12,}['"]/i.test(txt)) hit.push(`${f}:api_key`);
    if (/bearer\s+[A-Za-z0-9\-._~+/=]{12,}/i.test(txt)) hit.push(`${f}:bearer`);
  }
  assert.deepEqual(hit, []);
});
test("SEC-02 .env ignored", () => {
  const out = execSync("git check-ignore -v .env || true", { encoding: "utf8" });
  assert.match(out, /\.env/);
});
