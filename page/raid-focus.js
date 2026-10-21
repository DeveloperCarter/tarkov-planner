/* Manual raid focus. Pure UMD; selection never edits quest progress. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RaidFocus = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const taskId = q => q.bsgId || q.id;

  // null means not initialized yet. An explicit [] stays empty, including after new starts.
  function reconcile(saved, currentIds) {
    const current = new Set(currentIds);
    return saved == null ? [...current] : [...new Set(saved)].filter(id => current.has(id));
  }
  function choose(saved, currentIds, action, id) {
    const selected = reconcile(saved, currentIds);
    if (action === "all") return [...new Set(currentIds)];
    if (action === "clear") return [];
    if (!currentIds.includes(id)) return selected;
    if (action === "include") return [...new Set([...selected, id])];
    if (action === "exclude") return selected.filter(value => value !== id);
    return selected;
  }
  function read(scope, map, currentIds) {
    return scope ? reconcile(scope.raidFocus?.[map], currentIds) : [];
  }
  function write(scope, map, selected) {
    if (!scope) return;
    if (!scope.raidFocus) scope.raidFocus = {};
    scope.raidFocus[map] = [...selected];
  }
  function sync(scope, map, currentIds, knownIds, action, id) {
    if (!scope) return [];
    const saved = scope.raidFocus?.[map];
    const selected = action ? choose(saved, currentIds, action, id) : read(scope, map, currentIds);
    // The hand-built page covers fewer quests than the generated page of the same map.
    // Preserve selections it cannot display; only prune quests this page can evaluate.
    const other = (saved || []).filter(value => !knownIds.includes(value));
    if (saved != null || currentIds.length) write(scope, map, [...other, ...selected]);
    return selected;
  }
  function facts(q) {
    return { zones: [...new Set(q.objectives.flatMap(o => o.zone || []))], needs: q.needs || [],
      extraction: q.objectives.some(o => o.mustExtract || o.type === "extract") };
  }
  function project(data, selected) {
    const wanted = new Set(selected);
    const quests = data.quests.filter(q => wanted.has(taskId(q)));
    const ids = new Set(quests.map(q => q.id));
    const objectives = new Map(quests.flatMap(q => q.objectives.map(o => [o.id, o])));
    const zones = [...new Set(quests.flatMap(q => facts(q).zones))];
    const acquisition = data.acquisition.filter(a => a.for.some(id => ids.has(id)))
      .map(a => ({ ...a, for: a.for.filter(id => ids.has(id)) }));
    // Retain the authored order, but replace mixed prose with the selected objective facts.
    const raids = data.raids.map(r => ({ ...r, quests: r.quests.filter(id => ids.has(id)),
      stops: r.stops.map(st => ({ zone: st.zone, obj: st.obj.filter(id => objectives.has(id)) }))
        .filter(st => st.obj.length).map(st => ({ ...st, objectives: st.obj.map(id => objectives.get(id)) }))
    })).filter(r => r.quests.length || r.stops.length);
    const bring = new Map();
    for (const q of quests) for (const need of q.needs || []) {
      const key = JSON.stringify([need.kind || "item", need.itemIds?.slice().sort() || need.item]);
      const existing = bring.get(key);
      if (!existing) bring.set(key, { ...need, for: [q.id] });
      else {
        existing.for.push(q.id);
        // Reusable keys can be shared; consumable quantities are per quest.
        existing.qty = ["key", "weapon"].includes(need.kind) ? Math.max(existing.qty || 1, need.qty || 1)
          : (existing.qty || 1) + (need.qty || 1);
        existing.optional = !!existing.optional && !!need.optional;
      }
    }
    return { quests, zones, acquisition, raids, bring: [...bring.values()] };
  }
  return { taskId, reconcile, choose, read, write, sync, facts, project };
});
