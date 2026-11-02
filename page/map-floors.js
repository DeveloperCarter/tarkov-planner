/* Which map labels, extracts and keycard doors belong on a floor. Pure; the page passes its data and the chosen floor. */
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
  // Points with raw positions (extracts, keycard doors); ones without a height (older data) show on every floor.
  const pointsOn = (points, floor, floors) =>
    (points || []).filter(e => !floor || e.gy == null || floorOf(e, floors)?.id === floor.id);
  // Screen rectangles {left,right,top,bottom}, with a little breathing room around what's taken.
  const overlaps = (r, k) => r.left < k.right + 6 && r.right > k.left - 6 && r.top < k.bottom + 2 && r.bottom > k.top - 2;
  // An area name covered by a quest pin moves beside it, so the place the quest card names stays on
  // the map: the {dx, dy} of the nearest free side. Null when it isn't under a pin (another name or
  // an extract has the room), or no side is free within maxMove: a name further off points at the
  // wrong place (Shoreline's West Wing landed east of East Wing).
  function besidePin(rect, pins, taken, maxMove = 40) {
    const pin = pins.find(k => overlaps(rect, k));
    if (!pin) return null;
    const w = rect.right - rect.left, h = rect.bottom - rect.top;
    const cx = (pin.left + pin.right) / 2 - w / 2, cy = (pin.top + pin.bottom) / 2 - h / 2;
    const spots = [[cx, pin.bottom + 3], [pin.right + 7, cy], [pin.left - 7 - w, cy], [cx, pin.top - 3 - h]];
    const moves = spots.map(([left, top]) => ({ dx: left - rect.left, dy: top - rect.top }))
      .filter(m => Math.hypot(m.dx, m.dy) <= maxMove)
      .sort((a, b) => Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy));
    return moves.find(m => {
      const moved = { left: rect.left + m.dx, right: rect.right + m.dx, top: rect.top + m.dy, bottom: rect.bottom + m.dy };
      return !pins.concat(taken).some(k => overlaps(moved, k));
    }) || null;
  }
  return { onFloor, labelsOn, floorOf, pointsOn, overlaps, besidePin };
});
