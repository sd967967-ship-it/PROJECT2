// Test-only orchestrator (spawns node:test per suite; E2E excluded until Playwright installed).
const { spawnSync } = require("node:child_process");
const suites = { unit: ["tests/unit"], integration: ["tests/integration"], network: ["tests/network"], a11y: ["tests/a11y"], perf: ["tests/perf"], security: ["tests/security"], regression: ["tests/regression"] };
const want = process.argv[2] ? process.argv[2].split(",") : Object.keys(suites);
let fail = 0;
for (const s of want) {
  if (!suites[s]) { console.error(`unknown suite ${s}`); fail = 1; continue; }
  const r = spawnSync("node", ["--test", ...suites[s]], { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) fail = r.status;
}
process.exit(fail);
