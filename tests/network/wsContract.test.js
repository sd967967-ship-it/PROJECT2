const { test } = require("node:test");
const assert = require("node:assert/strict");
const { sub, diff, isValidDiff } = require("../mocks/ws.mock");

test("N-WS-01 sub/diff shapes match TECHFLOW", () => {
  const s = sub({ lamin: 0, lomin: 0, lamax: 10, lomax: 10 });
  assert.equal(s.op, "sub");
  const d = diff(Date.now(), [{ hex: "a1b2c3" }], []);
  assert.ok(isValidDiff(d));
});
test("N-WS-02 malformed diff rejected", () => {
  assert.equal(isValidDiff({ op: "diff" }), false);
  assert.equal(isValidDiff(null), false);
});
