const { test } = require("node:test");
const assert = require("node:assert/strict");
const { choosePort, startBackend, stopBackend, DEFAULT_PORT } = require("../../desktop/main");

test("desktop prefers the requested port when free", async () => {
  assert.equal(DEFAULT_PORT, 3000);
  assert.equal(await choosePort(48721), 48721);
});
test("desktop backend starts, serves health, and stops cleanly", async () => {
  const h = startBackend(0);
  const port = h.server.address().port;
  assert.ok(port > 0);
  const r = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).ok, true);
  stopBackend();
  await assert.rejects(fetch(`http://127.0.0.1:${port}/api/health`));
  stopBackend(); // idempotent
});
