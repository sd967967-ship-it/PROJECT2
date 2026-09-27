// Craft Module: curated human-made deep-space craft, anchored as clearly
// labeled vicinity markers on their target body's subpoint (never exact
// positions — the dossier carries agency, mission, and status).
const CRAFT = require("../../data/craft.json");
function wrapLon(lon) { return ((lon + 540) % 360) - 180; }
function clampLat(lat) { return Math.max(-90, Math.min(90, lat)); }
function toMovers(list, bodiesById) {
  return (list || CRAFT).map((c, i) => {
    const a = bodiesById && bodiesById[c.anchor];
    const ang = i * 2.4; // deterministic spiral so markers never stack
    return {
      id: `craft-${c.id}`, domain: "space", kind: "craft",
      lat: clampLat((a ? a.lat : 0) + 2.5 * Math.cos(ang)),
      lon: wrapLon((a ? a.lon : 0) + 2.5 * Math.sin(ang)),
      altM: null, velKmh: null, hdg: null, label: c.name,
      meta: { agency: c.agency, target: c.target, mission: c.mission, launchYear: c.launchYear, status: c.status, anchor: c.anchor, vicinity: true },
      src: "static",
    };
  });
}
module.exports = { CRAFT, toMovers };
