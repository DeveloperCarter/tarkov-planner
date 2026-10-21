/* Map cards use exactly the same scoped evaluation as the quest pages. */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./progress-store.js") : root.ProgressStore);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MapHome = api;
})(typeof self !== "undefined" ? self : this, function (Store) {
  "use strict";
  function summarize(data, store, mode, key = store.active[mode], levels = {}) {
    const group = data.modes[mode];
    if (!group) return [];
    const scope = store.scopes[key];
    if (!scope || scope.mode !== mode) key = "";
    return group.maps.map(map => {
      const saved = Number(levels[key]);
      const level = Number.isInteger(saved) && saved >= 1 && saved <= 100 ? saved : data.player.level;
      // Same split as the map page: quests located on this map, then quests spanning several maps.
      const listed = new Set(map.onMap || map.ids);
      const result = Store.evaluate(store, key, group.progression,
        { level, faction: data.player.faction, map: map.name, listed });
      const quests = map.ids.filter(id => result.quests[id]).map(id => ({ id, ...result.quests[id] }));
      return { ...map, current: quests.filter(q => q.current && listed.has(q.id)).length,
        multiMap: quests.filter(q => q.current && !listed.has(q.id)).length,
        possible: quests.filter(q => q.possible).length };
    });
  }
  function freshness(snapshot, now = Date.now()) {
    const at = Date.parse(snapshot);
    return !Number.isFinite(at) ? "Data date unavailable" :
      now - at > 86400000 ? "Data is more than a day old" : "Data is less than a day old";
  }
  return { summarize, freshness };
});
