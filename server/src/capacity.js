// Capacity Module: type -> seats. Unknown types fall back, labeled low confidence.
const TABLE = require("../../data/aircraft-capacity.json");
function getCapacity(type) {
  if (type && TABLE[type]) return { seats: TABLE[type], source: "static", confidence: "high" };
  return { seats: 180, source: "category-fallback", confidence: "low" };
}
module.exports = { getCapacity };
