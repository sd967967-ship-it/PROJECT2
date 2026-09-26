// Test-only env loader. Env vars win; no secrets here.
const fs = require("node:fs");
const path = require("node:path");
function load() {
  const file = path.join(__dirname, "..", ".env.example");
  const out = {
    TEST_ENV: process.env.TEST_ENV || "true",
    API_BASE_URL: process.env.API_BASE_URL || "http://127.0.0.1:0",
    USE_MOCK_API: process.env.USE_MOCK_API || "true",
  };
  try { fs.accessSync(file); } catch { return out; }
  return out;
}
module.exports = { load };
