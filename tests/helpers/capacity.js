// Test-only capacity lookup mirror (LLD Capacity Module).
const TABLE = { B788: 256, B77W: 396, A359: 253, B738: 189, B744: 416, B789: 236 };
function getCapacity(type) {
  if (TABLE[type]) return { seats: TABLE[type], source: "static", confidence: "high" };
  return { seats: 180, source: "category-fallback", confidence: "low" };
}
module.exports = { getCapacity, TABLE };
