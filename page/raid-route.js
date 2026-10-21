/* Spawn matching and open objective routes. Pure UMD; no storage, DOM or extract planning. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RaidRoute = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const distance = (a, b) => Math.hypot(a.gx - b.gx, a.gz - b.gz);
  const finite = p => p && Number.isFinite(p.gx) && Number.isFinite(p.gz);
  const EPS = 1e-9;

  function matchSpawn(data, gx, gz) {
    if (![gx, gz].every(Number.isFinite)) return null;
    const points = (data.spawns || []).slice().sort((a, b) =>
      distance(a, { gx, gz }) - distance(b, { gx, gz }) || a.gx - b.gx || a.gz - b.gz || compare(a.area, b.area));
    if (!points.length) return null;
    const spawn = points[0], metres = distance(spawn, { gx, gz });
    return metres <= 30 ? { spawn, area: (data.spawnAreas || []).find(a => a.id === spawn.area) || null, metres } : null;
  }

  // A done Set contains objective IDs. A Map/object may instead hold counters (number or {count}),
  // or explicit booleans/{done:true}. A partial counter never removes a stop.
  function isDone(done, objective) {
    if (done instanceof Set) return done.has(objective.id);
    const value = done instanceof Map ? done.get(objective.id) : done?.[objective.id];
    if (value === true || value?.done === true || value?.completed === true) return true;
    const count = typeof value === "number" ? value : value?.count;
    return Number.isFinite(count) && count >= (objective.count || 1);
  }

  function framePoint(data, point) {
    if (finite(point)) return point;
    // Manual area selection / re-route from an output stop. Uniform frame scale is exact.
    const scale = data.meta?.frame?.scale;
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y) || !(scale > 0)) {
      throw new TypeError("Start and route zones need game coordinates, or frame coordinates with meta.frame.scale");
    }
    // Relative coordinates suffice, anchored to a known spawn (rotation preserves distance).
    const anchor = (data.spawns || []).find(finite);
    if (!anchor) throw new TypeError("Frame conversion needs a spawn anchor");
    const east = (point.x - anchor.x) / scale, north = (anchor.y - point.y) / scale;
    const angle = -(data.meta?.rotation || 0) * Math.PI / 180;
    return { gx: anchor.gx + east * Math.cos(angle) - north * Math.sin(angle),
      gz: anchor.gz + east * Math.sin(angle) + north * Math.cos(angle) };
  }

  function startPoint(data, start) {
    if (typeof start === "string") {
      const area = (data.spawnAreas || []).find(a => a.id === start);
      if (!area) throw new RangeError(`Unknown spawn area: ${start}`);
      // The area marker is a centroid; raw member coordinates avoid frame rounding error.
      const members = (data.spawns || []).filter(s => s.area === start);
      if (members.length) return { gx: members.reduce((s, p) => s + p.gx, 0) / members.length,
        gz: members.reduce((s, p) => s + p.gz, 0) / members.length };
      return framePoint(data, area);
    }
    return framePoint(data, start);
  }

  const pathKey = path => path.join("\0");
  const better = (cost, path, previous) => !previous || cost < previous.cost - EPS ||
    (Math.abs(cost - previous.cost) <= EPS && compare(pathKey(path), pathKey(previous.path)) < 0);

  // Generalized Held-Karp: a mask covers objective requirements, not candidate zones. Visiting
  // one zone may satisfy several requirements; one objective's alternative zones need only one visit.
  function exact(nodes, groups, start) {
    const byRequirements = groups.length <= nodes.length;
    const full = (1 << (byRequirements ? groups.length : nodes.length)) - 1;
    const coverage = nodes.map((n, j) => byRequirements
      ? groups.reduce((bits, g, i) => bits | (g.includes(n.id) ? 1 << i : 0), 0) : 1 << j);
    const satisfied = mask => byRequirements ? mask === full
      : groups.every(g => nodes.some((n, j) => (mask & (1 << j)) && g.includes(n.id)));
    const states = Array.from({ length: full + 1 }, () => new Map());
    for (let j = 0; j < nodes.length; j++) {
      states[coverage[j]].set(j, { cost: distance(start, nodes[j]), path: [nodes[j].id] });
    }
    for (let mask = 1; mask <= full; mask++) for (const [last, state] of states[mask]) {
      for (let j = 0; j < nodes.length; j++) {
        const next = mask | coverage[j];
        if (next === mask) continue;
        const cost = state.cost + distance(nodes[last], nodes[j]), path = [...state.path, nodes[j].id];
        if (better(cost, path, states[next].get(j))) states[next].set(j, { cost, path });
      }
    }
    let best;
    for (let mask = 1; mask <= full; mask++) if (satisfied(mask)) {
      for (const state of states[mask].values()) if (better(state.cost, state.path, best)) best = state;
    }
    return best.path;
  }

  function length(path, byId, start) {
    let total = 0, previous = start;
    for (const id of path) { total += distance(previous, byId.get(id)); previous = byId.get(id); }
    return total;
  }
  function approximate(nodes, groups, start) {
    const byId = new Map(nodes.map(n => [n.id, n])), covered = new Set(), path = [];
    let previous = start;
    while (covered.size < groups.length) {
      const next = nodes.filter(n => groups.some((g, i) => !covered.has(i) && g.includes(n.id)))
        .sort((a, b) => distance(previous, a) - distance(previous, b) || compare(a.id, b.id))[0];
      path.push(next.id); previous = next;
      groups.forEach((g, i) => { if (g.includes(next.id)) covered.add(i); });
    }
    // Deterministic open-path 2-opt, including reversals that change the last objective.
    let improved = true;
    while (improved) {
      improved = false;
      const before = length(path, byId, start);
      outer: for (let i = 0; i < path.length - 1; i++) for (let j = i + 1; j < path.length; j++) {
        const candidate = [...path.slice(0, i), ...path.slice(i, j + 1).reverse(), ...path.slice(j + 1)];
        if (length(candidate, byId, start) < before - EPS) {
          path.splice(0, path.length, ...candidate); improved = true; break outer;
        }
      }
    }
    return path;
  }

  /** Straight-line route ending at the last objective. start: {gx,gz}, spawnArea ID, or a previous
   * output stop. zoneMode defaults to 'any'; explicit 'all' expands into separate requirements.
   * Missing referenced zones fail loudly. No-zone objectives are non-spatial and add no stop. */
  function route(data, selectedIds, start, { done = new Set() } = {}) {
    const wanted = new Set(selectedIds), objectives = [];
    const zones = data.zones || {};
    for (const quest of data.quests || []) {
      const id = quest.bsgId || quest.id;
      if (!wanted.has(id) && !wanted.has(quest.id)) continue;
      for (const objective of quest.objectives || []) {
        if (isDone(done, objective)) continue;
        const choices = [...new Set(objective.zone || [])].sort(compare);
        if (!choices.length) continue;
        for (const zone of choices) if (!zones[zone]) throw new RangeError(`Unknown objective zone: ${zone}`);
        for (const group of objective.zoneMode === "all" ? choices.map(z => [z]) : [choices]) {
          objectives.push({ quest: id, id: objective.id, choices: group });
        }
      }
    }
    if (!objectives.length) return { stops: [], metres: 0 };
    // Identical requirements merge; a subset makes its superset redundant (visiting A satisfies A|B).
    const unique = [...new Map(objectives.map(o => [o.choices.join("\0"), o.choices])).values()];
    const groups = unique.filter(g => !unique.some(h => h !== g && h.length < g.length && h.every(z => g.includes(z))));
    const ids = [...new Set(groups.flat())].sort(compare);
    const nodes = ids.map(id => ({ id, ...framePoint(data, zones[id]) }));
    const byId = new Map(nodes.map(n => [n.id, n]));
    const origin = startPoint(data, start);
    const isApproximate = Math.min(groups.length, nodes.length) > 10;
    const path = isApproximate ? approximate(nodes, groups, origin) : exact(nodes, groups, origin);
    const pending = new Set(objectives), stops = [];
    for (const zone of path) {
      const here = [...pending].filter(o => o.choices.includes(zone));
      if (!here.length) continue;
      here.forEach(o => pending.delete(o));
      const point = zones[zone];
      stops.push({ zone, x: point.x, y: point.y, ...framePoint(data, point),
        quests: [...new Set(here.map(o => o.quest))].sort(compare),
        objectives: [...new Set(here.map(o => o.id))].sort(compare) });
    }
    return { stops, metres: length(stops.map(s => s.zone), byId, origin),
      ...(isApproximate ? { approximate: true } : {}) };
  }
  return { matchSpawn, route };
});
