/* Pure quest availability and prerequisite inference. Status storage belongs to the caller. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.QuestProgress = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const canonical = status => ({ active: "started", complete: "completed" }[status] || status || "");

  function infer(progression, statuses = {}) {
    const effective = Object.fromEntries(Object.entries(statuses).map(([id, value]) =>
      [id, typeof value === "string" ? { status: canonical(value) } : { ...value, status: canonical(value.status) }]));
    const queue = Object.keys(effective).filter(id => ["started", "completed"].includes(effective[id].status));
    const visited = new Set();
    while (queue.length) {
      const id = queue.pop();
      if (visited.has(id)) continue;
      visited.add(id);
      for (const req of progression[id]?.requirements || []) {
        // Only an unambiguous completion gate proves completion; OR statuses do not.
        if (req.anyOf || req.statuses.length !== 1 || canonical(req.statuses[0]) !== "completed") continue;
        const current = effective[req.task];
        if (current?.source === "manual") continue;
        if (current?.status !== "completed") effective[req.task] = { status: "completed", source: "inferred" };
        queue.push(req.task);
      }
    }
    return effective;
  }

  function evaluate(progression, statuses = {}, { level = 1, faction = "Any" } = {}) {
    const effective = infer(progression, statuses);
    const quests = {};
    for (const [id, task] of Object.entries(progression)) {
      const status = effective[id]?.status || "";
      const reasons = (task.unresolved || []).map(name => ({ type: "unresolved", name }));
      if (status === "failed" && !task.restartable) reasons.push({ type: "failed" });
      if (level < (task.minLevel || 1)) reasons.push({ type: "level", level: task.minLevel });
      if (task.faction && task.faction !== "Any" && task.faction !== faction) reasons.push({ type: "faction", faction: task.faction });
      const groups = new Map();
      for (const req of task.requirements || []) {
        if (req.anyOf) {
          if (!groups.has(req.anyOf)) groups.set(req.anyOf, []);
          groups.get(req.anyOf).push(req);
        } else if (!req.statuses.some(s => canonical(s) === effective[req.task]?.status)) {
          reasons.push({ type: "prerequisite", task: req.task, statuses: req.statuses });
        }
      }
      for (const requirements of groups.values()) {
        if (!requirements.some(req => req.statuses.some(s => canonical(s) === effective[req.task]?.status))) {
          reasons.push({ type: "anyOf", requirements });
        }
      }
      // Accepted quests are evidence of current membership even if static gates disagree.
      quests[id] = { status, current: status === "started", possible: status !== "started" && status !== "completed" && reasons.length === 0,
        inferred: effective[id]?.source === "inferred", completed: status === "completed",
        locked: status !== "completed" && reasons.length > 0, available: status !== "completed" && reasons.length === 0, reasons };
    }
    return { statuses: effective, quests };
  }

  function visible(quest, view = "available") {
    if (view === "current") return quest.current;
    if (view === "possible") return quest.possible;
    return view === "all" || (view === "active" ? quest.status === "started" : quest.available);
  }
  return { infer, evaluate, visible };
});
