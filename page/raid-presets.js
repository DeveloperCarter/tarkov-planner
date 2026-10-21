/* Current-quest focus presets. Caller supplies current quests; no inferred unlocks or status edits. */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require('./raid-route.js') : root.RaidRoute);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RaidPresets = api;
})(typeof self !== "undefined" ? self : this, function (Route) {
  "use strict";
  const definitions = [
    ['all', 'All current', 'Every current quest on this map, including multi-map quests.'],
    ['keys', 'Key raids', 'Quests listing a required key. Check which keys you own.'],
    ['no-keys', 'No required keys', 'Quests with no required keys listed. Optional keys may still help.'],
    ['items', 'Quest-item pickups', 'Unfinished pickups at known locations; check extraction requirements.'],
    ['placements', 'Mark & place', 'Unfinished marker or item placements.'],
    ['combat', 'Combat', 'Unfinished elimination objectives.'],
    ['kappa', 'Kappa quests', 'Current quests confirmed as required by the cached wiki.'],
  ];
  const id = q => q.bsgId || q.id;
  const candidates = (quests, kappaOnly = false) => quests.filter(q => !kappaOnly || (q.kappa === true && q.kappaSource === 'wiki'));
  function list(currentQuests, done = {}) {
    const pending = q => (q.objectives || []).filter(o => !o.optional && !Route.isDone(done, o));
    const hasKey = q => (q.needs || []).some(n => n.kind === 'key' && !n.optional);
    const predicates = {
      all: () => true, keys: q => hasKey(q) && pending(q).some(o => o.zone?.length), 'no-keys': q => !hasKey(q),
      items: q => pending(q).some(o => o.type === 'findQuestItem' || (o.type === 'findItem' && o.zone?.length)),
      placements: q => pending(q).some(o => ['mark', 'plantItem', 'plantQuestItem'].includes(o.type)),
      combat: q => pending(q).some(o => o.type === 'shoot'),
      kappa: q => q.kappa === true && q.kappaSource === 'wiki',
    };
    return definitions.map(([key, name, description]) => ({ id: key, name, description,
      ids: [...new Set(currentQuests.filter(predicates[key]).map(id))].sort() }));
  }
  function choose(currentQuests, preset, done) {
    const result = list(currentQuests, done).find(p => p.id === preset);
    if (!result) throw new RangeError('Unknown raid focus preset');
    return result.ids;
  }
  return { list, choose, candidates };
});
