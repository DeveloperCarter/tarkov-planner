/* Transient raid planning state. Never persisted; no raw log lines or identity retained. */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require('./raid-route.js') : root.RaidRoute);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RaidSession = api;
})(typeof self !== "undefined" ? self : this, function (Route) {
  "use strict";
  const empty = () => ({ start: null, source: '', startedAt: null, waiting: false, unavailable: false });
  function reduce(state, data, event) {
    if (!event.map || event.map !== data.meta.key) return state;
    if (event.kind === 'raid-loading') return empty();
    if (event.kind === 'raid-started') return { ...state, startedAt: event.at, waiting: !state.start };
    if (event.kind !== 'spawn-position' || state.source === 'manual' || state.startedAt === null ||
        event.at < state.startedAt || event.at - state.startedAt > 10000) return state;
    const match = Route.matchSpawn(data, event.x, event.z);
    return match ? { ...state, start: { gx: match.spawn.gx, gz: match.spawn.gz }, source: 'log',
      area: match.area?.id, waiting: false, unavailable: false }
      : { ...state, waiting: false, unavailable: true };
  }
  function choose(state, data, area) {
    if (!area) return { ...state, start: null, source: '', area: null, waiting: false };
    if (!(data.spawnAreas || []).some(a => a.id === area)) throw new RangeError('Unknown spawn area');
    return { ...state, start: area, area, source: 'manual', waiting: false, unavailable: false };
  }
  // A spawn point picked on the map (frame coordinates); the route starts exactly there.
  function nearestSpawn(data, x, y) {
    let best = null;
    for (const spawn of data.spawns || []) {
      const px = Math.hypot(spawn.x - x, spawn.y - y);
      if (!best || px < best.px) best = { spawn, px };
    }
    return best && { spawn: best.spawn, metres: best.px / (data.meta.frame?.scale || 1) };
  }
  function choosePoint(state, spawn) {
    return { ...state, start: { gx: spawn.gx, gz: spawn.gz }, area: spawn.area, source: 'manual', waiting: false, unavailable: false };
  }
  function needsArea(state, now) {
    return !state.start && (state.unavailable || (state.startedAt !== null && now - state.startedAt >= 10000));
  }
  // Advance only through the completed prefix of the prior route; do not teleport to an out-of-order check.
  function advance(state, stops, completed) {
    let last;
    for (const stop of stops) {
      if (!stop.objectives.length || !stop.objectives.every(id => completed.has(id))) break;
      last = stop;
    }
    return last ? { ...state, start: { gx: last.gx, gz: last.gz }, source: 'objective' } : state;
  }
  function marker(data, start) {
    if (typeof start === 'string') return (data.spawnAreas || []).find(a => a.id === start) || null;
    if (!start) return null;
    const anchor = data.spawns?.[0], scale = data.meta.frame?.scale;
    if (!anchor || !(scale > 0)) return null;
    const angle = (data.meta.rotation || 0) * Math.PI / 180;
    const dx = start.gx - anchor.gx, dz = start.gz - anchor.gz;
    return { x: anchor.x + (dx * Math.cos(angle) - dz * Math.sin(angle)) * scale,
      y: anchor.y - (dx * Math.sin(angle) + dz * Math.cos(angle)) * scale };
  }
  return { empty, reduce, choose, nearestSpawn, choosePoint, needsArea, advance, marker };
});
