// Test-only mock feed server. Modes: ok|empty|invalid|slow|flaky|denied. No prod data.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
function snapshotBody() {
  return fs.readFileSync(path.join(__dirname, "..", "fixtures", "snapshot.json"));
}
function start(mode = "ok") {
  let hits = 0;
  const srv = http.createServer((req, res) => {
    if (req.url !== "/snapshot") { res.writeHead(404); res.end("{}"); return; }
    hits++;
    if (mode === "denied") { res.writeHead(429, { "retry-after": "30" }); res.end("{}"); return; }
    if (mode === "empty") { res.writeHead(200, { "content-type": "application/json" }); res.end('{"t":0,"states":[]}'); return; }
    if (mode === "invalid") { res.writeHead(200, { "content-type": "application/json" }); res.end("{not-json"); return; }
    if (mode === "slow") { setTimeout(() => { res.writeHead(200, { "content-type": "application/json" }); res.end(snapshotBody()); }, 3000); return; }
    if (mode === "flaky" && hits === 1) { res.writeHead(500); res.end("{}"); return; }
    res.writeHead(200, { "content-type": "application/json" }); res.end(snapshotBody());
  });
  return new Promise((resolve) => srv.listen(0, "127.0.0.1", () => resolve({ srv, url: `http://127.0.0.1:${srv.address().port}` })));
}
module.exports = { start };
