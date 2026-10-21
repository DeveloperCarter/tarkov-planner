/* Whole-character keep list and Kappa progress. No DOM or storage access. */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./progress-store.js") : root.ProgressStore);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.QuestCareer = api;
})(typeof self !== "undefined" ? self : this, function (Store) {
  "use strict";
  function evaluate(data, store, key, { level = 1, faction = "USEC", done = {} } = {}) {
    const scope = store.scopes[key]?.mode === data.mode ? store.scopes[key] : null;
    key = scope ? key : "";
    const result = Store.evaluate(store, key, data.progression, { level, faction });
    const tasks = data.tasks.filter(t => !t.faction || t.faction === "Any" || t.faction === faction);
    const byId = Object.fromEntries(tasks.map(t => [t.id, t]));
    const quests = Object.fromEntries(tasks.map(t => {
      const q = { ...result.quests[t.id] };
      const listed = t.maps.filter(m => m.onMap);
      if (q.current && listed.length) q.current = listed.some(m =>
        Store.isCurrent(scope, t.id, result.statuses[t.id], m.name));
      return [t.id, q];
    }));
    const children = new Map();
    for (const t of tasks) for (const r of data.progression[t.id]?.requirements || []) {
      if (!children.has(r.task)) children.set(r.task, new Set());
      children.get(r.task).add(t.id);
    }
    const descendants = id => {
      const seen = new Set([id]), queue = [...(children.get(id) || [])];
      let count = 0;
      while (queue.length) {
        const next = queue.pop();
        if (seen.has(next)) continue;
        seen.add(next);
        if (byId[next]?.kappa === true && !quests[next]?.completed) count++;
        queue.push(...(children.get(next) || []));
      }
      return count;
    };
    const required = tasks.filter(t => t.kappa === true);
    const entry = t => ({ ...t, ...quests[t.id], unlocks: descendants(t.id),
      traderRequirements: data.progression[t.id]?.traderRequirements || [] });
    // Accepted quests first: they're already in progress. Then downstream Kappa unlocks, then level.
    const next = required.filter(t => !quests[t.id]?.completed && (quests[t.id]?.current || quests[t.id]?.possible))
      .map(entry).sort((a, b) => Number(!!b.current) - Number(!!a.current) || b.unlocks - a.unlocks || (a.minLevel || 1) - (b.minLevel || 1) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    const blocked = required.filter(t => !quests[t.id]?.completed && !quests[t.id]?.current && !quests[t.id]?.possible).map(entry);
    const traders = [...new Set(required.map(t => t.trader))].sort().map(name => {
      const rows = required.filter(t => t.trader === name);
      return { name, total: rows.length, completed: rows.filter(t => quests[t.id]?.completed).length };
    });
    const keep = new Map(), collector = [];
    for (const t of tasks) {
      const q = quests[t.id];
      if (q?.completed) continue;
      const failed = q?.status === "failed" && !data.progression[t.id]?.restartable;
      for (const req of t.keep || []) {
        const checked = !!scope?.collector?.[req.id];
        if (t.collector) collector.push({ ...req, quest: t.id, checked });
        if (failed || (t.collector && checked)) continue;
        const value = scope && !t.collector ? done[req.id] : 0;
        const count = value === true ? 0 : req.count == null ? null : Math.max(0, req.count - (Number(value) || 0));
        if (count === 0) continue;
        const bucket = q?.current ? "current" : q?.possible ? "possible" : "later";
        const signature = req.items.map(i => i.id).sort().join("|");
        if (!keep.has(signature)) keep.set(signature, { items: req.items, current: 0, possible: 0, later: 0, unknown: [], quests: [] });
        const row = keep.get(signature);
        if (count == null) row.unknown.push(bucket); else row[bucket] += count;
        row.quests.push({ id: t.id, name: t.name, count, bucket, collector: !!t.collector, note: req.note });
      }
    }
    const collectorTask = tasks.find(t => t.collector);
    if (collectorTask && quests[collectorTask.id]?.completed) {
      for (const req of collectorTask.keep || []) collector.push({ ...req, quest: collectorTask.id, checked: true });
    }
    return { scoped: !!scope, quests, keep: [...keep.values()].sort((a, b) =>
      Number(b.current + b.possible > 0) - Number(a.current + a.possible > 0) || a.items[0].name.localeCompare(b.items[0].name)),
      collector, kappa: { total: required.length, completed: required.filter(t => quests[t.id]?.completed).length,
        implied: required.filter(t => quests[t.id]?.completed && quests[t.id]?.inferred).length,
        next, blocked, traders, review: tasks.filter(t => t.kappa == null),
        maps: Object.fromEntries([...new Set(tasks.flatMap(t => t.maps.map(m => m.key)))].map(map =>
          [map, next.filter(t => t.maps.some(m => m.key === map)).length])) } };
  }
  return { evaluate };
});
