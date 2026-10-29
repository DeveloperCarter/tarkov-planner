/* Which map labels belong on a floor. Pure; the page passes its labels and the chosen floor. */
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
  return { onFloor, labelsOn };
});
