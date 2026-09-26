// Test-only ws message builders matching TECHFLOW contract (no socket dep).
function sub(bbox) { return { op: "sub", bbox }; }
function diff(t, upsert, remove = []) { return { op: "diff", t, upsert, remove }; }
function isValidDiff(m) {
  return !!m && m.op === "diff" && typeof m.t === "number" && Array.isArray(m.upsert) && Array.isArray(m.remove);
}
module.exports = { sub, diff, isValidDiff };
