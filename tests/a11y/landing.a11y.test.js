const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "..", "public", "index.html"), "utf8");

test("A11Y-01 html lang set", () => assert.match(html, /<html lang="en"/));
test("A11Y-02 search has accessible name", () => {
  assert.match(html, /<input[^>]*id="search"/);
  assert.match(html, /placeholder="[^"]+"/);
});
test("A11Y-03 no positive tabindex (focus order natural)", () => {
  assert.doesNotMatch(html, /tabindex="[1-9]/);
});
test("A11Y-04 status badge exists for announcements", () => {
  assert.ok(html.includes('id="modeBadge"'));
});
