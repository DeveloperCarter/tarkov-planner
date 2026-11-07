/* Map cards use exactly the same scoped evaluation as the quest pages. */
(function (root, factory) {
  const api = typeof module === "object" && module.exports ? factory(require("./progress-store.js"), require("./raid-suggest.js")) : factory(root.ProgressStore, root.RaidSuggest);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MapHome = api;
})(typeof self !== "undefined" ? self : this, function (Store, Suggest) {
  "use strict";
  // filter: QuestFilter's fields count only matching quests (data.modes[mode].quests holds each
  // quest's name, trader, wiki-confirmed Kappa flag and effort). Each card lists its matching current quests.
  function summarize(data, store, mode, key = store.active[mode], levels = {}, filter = {}) {
    const group = data.modes[mode];
    if (!group) return [];
    const info = group.quests || {};
    const wanted = id => (!filter.traders?.length || filter.traders.includes(info[id]?.trader)) && (!filter.kappa || info[id]?.kappa === true) &&
      (!filter.easy || info[id]?.easy === true) && (!filter.ready || info[id]?.ready === true) && (!filter.noKeys || (info[id]?.effort && !info[id].effort.keys?.length)) &&
      (!filter.kinds?.length || filter.kinds.some(k => info[id]?.effort?.kinds?.includes(k)));
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
        matches: [...here, ...multi].map(q => ({ id: q.id, name: info[q.id]?.name || q.id, trader: info[q.id]?.trader || "", kappa: info[q.id]?.kappa === true, easy: info[q.id]?.easy === true, ready: info[q.id]?.ready === true, effort: info[q.id]?.effort })) };
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
  // One map's suggested raids from raid-areas.json. Quests come from a card's matches, so the filter
  // applies; done is that map's saved objective checklist.
  // whole: only quests the raid's area finishes (the Finishes here filter).
  function bestRaid(areas, matches, done, aim, whole = false) {
    if (!areas) return null;
    const ids = new Set(matches.map(q => q.id));
    return Suggest.plan(areas, areas.quests.filter(q => ids.has(q.id)), { done, aim, whole }).raids[0] || null;
  }
  // A card's matches that one raid on that map can finish.
  function finishing(areas, matches, done) {
    const byId = new Map(areas.quests.map(q => [q.id, q]));
    return matches.filter(m => byId.has(m.id) && Suggest.finishable(areas, byId.get(m.id), { done }));
  }
  return { summarize, traders, freshness, bestRaid, finishing };
});
