/* Map cards use exactly the same scoped evaluation as the quest pages. */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./progress-store.js") : root.ProgressStore);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MapHome = api;
})(typeof self !== "undefined" ? self : this, function (Store) {
  "use strict";
  // filter: { trader, kappa } counts only matching quests (data.modes[mode].quests holds each
  // quest's name, trader and wiki-confirmed Kappa flag). Each card lists its matching current quests.
  function summarize(data, store, mode, key = store.active[mode], levels = {}, filter = {}) {
    const group = data.modes[mode];
    if (!group) return [];
    const info = group.quests || {};
    const wanted = id => (!filter.trader || info[id]?.trader === filter.trader) && (!filter.kappa || info[id]?.kappa === true);
    const scope = store.scopes[key];
    if (!scope || scope.mode !== mode) key = "";
    return group.maps.map(map => {
      const saved = Number(levels[key]);
      const level = Number.isInteger(saved) && saved >= 1 && saved <= 100 ? saved : data.player.level;
      // Same split as the map page: quests located on this map, then quests spanning several maps.
      const listed = new Set(map.onMap || map.ids);
      const result = Store.evaluate(store, key, group.progression,
        { level, faction: data.player.faction, map: map.name, listed });
      const quests = map.ids.filter(id => result.quests[id] && wanted(id)).map(id => ({ id, ...result.quests[id] }));
      const here = quests.filter(q => q.current && listed.has(q.id)), multi = quests.filter(q => q.current && !listed.has(q.id));
      return { ...map, current: here.length, multiMap: multi.length, possible: quests.filter(q => q.possible).length,
        matches: [...here, ...multi].map(q => ({ id: q.id, name: info[q.id]?.name || q.id, trader: info[q.id]?.trader || "" })) };
    });
  }
  function freshness(snapshot, now = Date.now()) {
    const at = Date.parse(snapshot);
    return !Number.isFinite(at) ? "Data date unavailable" :
      now - at > 86400000 ? "Data is more than a day old" : "Data is less than a day old";
  }
  // Traders with current quests in this scope (for the filter), most current quests first.
  function traders(cards) {
    const counts = new Map();
    for (const card of cards) for (const q of card.matches || []) if (q.trader) {
      if (!counts.has(q.trader)) counts.set(q.trader, new Set());
      counts.get(q.trader).add(q.id);
    }
    return [...counts].map(([name, ids]) => ({ name, count: ids.size })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }
  return { summarize, traders, freshness };
});
