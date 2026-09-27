// U-STATIC: contract assertions over public/ source text (no DOM, no app edits).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "..", "public", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "..", "public", "index.html"), "utf8");

test("U-STATIC-01 three imagery layers (sat/hybrid/street)", () => {
  assert.match(app, /google\.com\/vt\/lyrs=s/);
  assert.match(app, /google\.com\/vt\/lyrs=y/);
  assert.match(app, /World_Imagery/);
  assert.match(app, /openstreetmap/);
  assert.match(html, /data-lyr="sat"/);
  assert.match(html, /data-lyr="esri"/);
  const two = fs.readFileSync(path.join(__dirname, "..", "..", "public", "app2d.js"), "utf8");
  assert.match(two, /markerClusterGroup/);
});
test("U-STATIC-02 free 3D globe, render-on-demand", () => {
  assert.match(app, /new Cesium\.Viewer/);
  assert.match(app, /requestRenderMode/);
  assert.match(app, /new Cesium\.ImageryLayer/);
  assert.match(app, /LEFT_CLICK/);
});
test("U-STATIC-03 detail panel IDs present", () => {
  for (const id of ["pSpeed", "pAlt", "pHdg", "pVs", "pNear", "pCap", "pRoute", "pServices", "pFares", "pFlag", "search", "results", "globe", "zin", "zout", "follow"]) {
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
test("U-STATIC-06 loader has fallback CDN and diagnostic box", () => {
  assert.match(html, /cdn\.jsdelivr\.net\/npm\/cesium/);
  assert.ok(html.includes('id="noglMsg"'));
  assert.match(html, /webgl2/);
});
test("U-STATIC-07 automatic 2D fallback path", () => {
  assert.match(html, /shared\.js/);
  assert.match(html, /app2d\.js/);
  assert.match(html, /leaflet/);
  assert.ok(html.includes('id="map2d"'));
  const two = fs.readFileSync(path.join(__dirname, "..", "..", "public", "app2d.js"), "utf8");
  assert.match(two, /World_Imagery/);
  assert.match(two, /renderDossier/);
  assert.match(two, /markerClusterGroup/);
  assert.match(two, /plane-icon/);
  assert.match(two, /rotate\(/);
  const shared = fs.readFileSync(path.join(__dirname, "..", "..", "public", "shared.js"), "utf8");
  assert.match(shared, /renderDossier/);
  assert.match(shared, /updateTicker/);
});
test("U-STATIC-08 small yellow plane markers (numbers only for dense clusters)", () => {
  assert.match(app, /drawPlane/);
  assert.match(app, /planeBillboard/);
  assert.match(app, /#ffd23f/);
  assert.match(app, /CLUSTER_AT/);
  assert.match(app, /clusterBadge/); // clusters keep counts; singles are yellow planes
  const planes2d = fs.readFileSync(path.join(__dirname, "..", "..", "public", "app2d.js"), "utf8");
  assert.match(planes2d, /#ffd23f/);
  assert.match(planes2d, /disableClusteringAtZoom/);
});
test("U-STATIC-10 four tracking modes over backend only", () => {
  const two = fs.readFileSync(path.join(__dirname, "..", "..", "public", "app2d.js"), "utf8");
  const shared = fs.readFileSync(path.join(__dirname, "..", "..", "public", "shared.js"), "utf8");
  for (const d of ["sky", "sea", "streets", "space"]) assert.ok(html.includes(`data-domain="${d}"`), `missing mode ${d}`);
  assert.match(html, /aria-label="Tracking mode"/);
  for (const u of ["/api/sea/vessels/", "/api/streets/vehicles/", "/api/space/objects/"]) assert.ok(shared.includes(u), `missing ${u}`);
  assert.ok(app.includes("/api/${state.domain}/snapshot") || two.includes("/api/${state2d.domain}/snapshot"), "missing domain snapshot hook");
  assert.ok(app.includes('domain: state.domain') || two.includes('domain: state2d.domain'), "missing domain ws sub");
  assert.match(shared, /DOMAINS/);
  assert.match(shared, /renderDomainDossier/);
  for (const src of [app, two, shared, html]) {
    assert.doesNotMatch(src, /celestrak\.org/i);
    assert.doesNotMatch(src, /aiscast\.|aisstream\./i);
    assert.doesNotMatch(src, /gtfs-realtime|gtfsrt/i);
  }
});
test("U-STATIC-09 brand logo + navy/silver gradient theme", () => {
  assert.match(html, /logo\.svg/);
  assert.match(html, /rel="icon"/);
  const css = fs.readFileSync(path.join(__dirname, "..", "..", "public", "styles.css"), "utf8");
  assert.match(css, /--brand-gradient/);
  assert.match(css, /--silver-text/);
  assert.match(css, /\.logo/);
  const logo = fs.readFileSync(path.join(__dirname, "..", "..", "public", "logo.svg"), "utf8");
  assert.match(logo, /<svg/);
  assert.match(logo, /SkyTrack/);
});
