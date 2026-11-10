/* Map cards use exactly the same scoped evaluation as the quest pages. */
(function (root, factory) {
  const api = typeof module === "object" && module.exports ? factory(require("./progress-store.js"), require("./raid-suggest.js"), require("./quest-filter.js")) : factory(root.ProgressStore, root.RaidSuggest, root.QuestFilter);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MapHome = api;
})(typeof self !== "undefined" ? self : this, function (Store, Suggest, Filter) {
  "use strict";
  function summarize(data, store, mode, key = store.active[mode], levels = {}) {
    const group = data.modes[mode];
    if (!group) return [];
    const info = group.quests || {};
    const scope = store.scopes[key];
    if (!scope || scope.mode !== mode) key = "";
    return group.maps.map(map => {
      const saved = Number(levels[key]);
      const level = Number.isInteger(saved) && saved >= 1 && saved <= 100 ? saved : data.player.level;
      // Same split as the map page: quests located on this map, then quests spanning several maps.
      const listed = new Set(map.onMap || map.ids);
      const result = Store.evaluate(store, key, group.progression,
        { level, faction: data.player.faction, map: map.name, listed });
      const matches = map.ids.filter(id => result.quests[id]?.current)
        .map(id => ({ ...info[id], id, name: info[id]?.name || id, onMap: listed.has(id) }));
      const current = matches.filter(q => q.onMap).length;
      return { ...map, current, multiMap: matches.length - current,
        possible: map.ids.filter(id => result.quests[id]?.possible).length,
        matches: matches.sort((a, b) => Number(b.onMap) - Number(a.onMap)) };
    });
  }
  function filterCards(cards, filter) {
    return cards.map(card => {
      const matches = card.matches.filter(q => Filter.matches(q, filter));
      const current = matches.filter(q => q.onMap).length;
      return { ...card, matches, current, multiMap: matches.length - current };
    }).filter(card => card.matches.length);
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
  // Home ranks by the card's headline count or by rewards from listed quests. Multi-map quests
  // are counted separately; their full reward doesn't belong to every map with an objective.
  // A nearby raid is a suggestion on the card, never an input to the map's rank.
  function rankCards(cards, areas = {}, { aim, whole, checklist = () => ({}) } = {}) {
    aim = Suggest.normalizeAim(aim);
    const trader = aim.startsWith("rep:") ? aim.slice(4) : null;
    const byStanding = aim === "rep" || !!trader;
    const byXp = aim === "xp";
    return cards.map(card => {
      const map = areas[card.key];
      const listed = new Set(card.matches.filter(q => q.onMap !== false).map(q => q.id));
      const quests = (byXp || byStanding) && map ? map.quests.filter(q => q.onMap !== false && listed.has(q.id)) : null;
      const xp = byXp && quests ? quests.reduce((sum, q) => sum + (q.rewards?.xp || 0), 0) : null;
      const standing = byStanding && quests ? quests.reduce((sum, q) => sum + Suggest.standing(q, trader), 0) : null;
      return { ...card, xp, standing, raid: bestRaid(map, card.matches, checklist(card), aim, whole) };
    }).sort((a, b) => {
      const score = card => card.xp ?? card.standing ?? 0;
      const delta = score(b) - score(a);
      return Number(!!b.matches.length) - Number(!!a.matches.length) ||
        (Math.abs(delta) > 1e-9 ? delta : 0) || b.current - a.current || b.multiMap - a.multiMap ||
        (a.name || a.key).localeCompare(b.name || b.key);
    });
  }
  // A card's matches that one raid on that map can finish.
  function finishing(areas, matches, done) {
    const byId = new Map(areas.quests.map(q => [q.id, q]));
    return matches.filter(m => byId.has(m.id) && Suggest.finishable(areas, byId.get(m.id), { done }));
  }
  return { summarize, filterCards, traders, freshness, bestRaid, finishing, rankCards };
});
