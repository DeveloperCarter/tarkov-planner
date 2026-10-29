/* Which map labels and extracts belong on a floor. Pure; the page passes its data and the chosen floor. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MapFloors = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  // A label's height range (bottom..top, metres) must overlap the floor's (height: [low, high]).
  // The ranges are open: the Lab's ground-floor rooms top out at 2 m and the second level starts
  // at 3 m, but tarkov.dev gives both floors the 3 m boundary. Labels or floors without heights always match.
  function onFloor(label, floor) {
    if (!floor || !Array.isArray(floor.height) || (label.top == null && label.bottom == null)) return true;
    const [low, high] = floor.height;
    return (label.bottom ?? -Infinity) < high && (label.top ?? Infinity) > low;
  }
  const labelsOn = (labels, floor) => (labels || []).filter(l => onFloor(l, floor));

  // The floor a point (raw game gx, gz and height gy) is on, the way tarkov.dev assigns map layers:
  // the first floor with an extent whose height range [low, high) holds gy and whose boxes, if any,
  // hold (gx, gz); otherwise the base floor. The Lab's Second Level only covers its north-west
  // block, so Hangar Gate and Parking Gate stay on the ground floor although they are above 3 m.
  const inBox = (p, [[x1, z1], [x2, z2]]) =>
    p.gx >= Math.min(x1, x2) && p.gx <= Math.max(x1, x2) && p.gz >= Math.min(z1, z2) && p.gz <= Math.max(z1, z2);
  const inExtent = (p, e) => p.gy >= e.height[0] && p.gy < e.height[1] && (!e.bounds || e.bounds.some(b => inBox(p, b)));
  function floorOf(point, floors) {
    if (!floors?.length || point?.gy == null) return null;
    return floors.find(f => (f.extents || []).some(e => inExtent(point, e)))
      || floors.find(f => f.base) || floors.find(f => !f.extents) || null;
  }
  // Extracts without a height (older data) show on every floor.
  const extractsOn = (extracts, floor, floors) =>
    (extracts || []).filter(e => !floor || e.gy == null || floorOf(e, floors)?.id === floor.id);
  return { onFloor, labelsOn, floorOf, extractsOn };
});
