/* Visual quest focus only: never edits selection, objectives or quest status. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.QuestNavigation = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  function current(ids, id) { return ids.includes(id) ? id : ids[0] || null; }
  function step(ids, id, direction) {
    if (!ids.length || ![-1, 1].includes(direction)) return current(ids, id);
    const index = ids.indexOf(id);
    if (index < 0) return direction === 1 ? ids[0] : ids[ids.length - 1];
    return ids[(index + direction + ids.length) % ids.length];
  }
  function keyboard(event) {
    if (event.repeat || !event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey) return 0;
    return event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
  }
  return { current, step, keyboard };
});
