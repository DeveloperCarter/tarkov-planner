/* Suggested raids: groups current quests by where their unfinished work is. Pure UMD; it suggests only,
   and never edits a selection or a quest's status. Distances ignore walls and floors, as routes do. */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./raid-route.js") : root.RaidRoute);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RaidSuggest = api;
})(typeof self !== "undefined" ? self : this, function (Route) {
  "use strict";
  // Metres from an area's centre. On real logs 60 m left Woods with no raids and split Shoreline's Resort
  // in two; 150 m and up joined separate compounds on Customs and Reserve (checked 2026-11-03).
  const RADIUS = 100, MIN_QUESTS = 2, MAX_RAIDS = 6;
  const AIMS = { quests: "Most quests", xp: "Most XP", rep: "Most standing" };
  const AIM_KEY = "eft-raid-aim";
  const id = q => q.bsgId || q.id;

  // "rep:Prapor" is standing with one trader. Anything else unknown means the default.
  const normalizeAim = aim => typeof aim === "string" && (Object.hasOwn(AIMS, aim) || /^rep:.+/.test(aim)) ? aim : "quests";
  const standing = (q, trader) => (q.rewards?.rep || []).filter(r => !trader || r.trader === trader).reduce((sum, r) => sum + r.standing, 0);
  function worth(q, aim) {
    if (aim === "xp") return q.rewards?.xp || 0;
    if (aim === "rep") return standing(q);
    return aim.startsWith("rep:") ? standing(q, aim.slice(4)) : 1;
  }
  const keysOf = q => (q.needs || []).filter(n => n.kind === "key" && !n.optional).map(n => n.item);
  const located = (q, zones, done) => (q.objectives || []).filter(o => !o.optional && !Route.isDone(done, o) && o.zone?.some(z => zones[z]));

  /** Each quest lands in exactly one place:
   *  raids: groups around one spot, best for the aim first, with what they add up to;
   *  anyRaid: nothing left at a fixed spot, so it fits any raid here;
   *  elsewhere: spots of its own, away from every group.
   *  An objective with alternative spots counts when one is in the area. A quest finishes there when all
   *  of its unfinished located objectives can be done there; a multi-map quest also needs other maps. */
  // Distances between a map's zones, and which of an objective's spots lie in a seed's area.
  function geometry(zones, radius) {
    const distance = (a, b) => a === b ? 0 : zones[a]?.gx == null || zones[b]?.gx == null ? Infinity : Math.hypot(zones[a].gx - zones[b].gx, zones[a].gz - zones[b].gz);
    const here = (seed, o) => o.zone.filter(z => zones[z] && distance(seed, z) <= radius);
    // Objectives this seed can serve: one spot of an any-of list, or the whole of an explicit "all".
    const serves = (seed, o) => o.zoneMode === "all" ? here(seed, o).length === o.zone.length : here(seed, o).length > 0;
    return { distance, here, serves };
  }

  /** Can one raid here finish the quest? Not a multi-map quest, and every unfinished located objective has
   *  a spot within one area. A quest with nothing located left (kills, hand-ins) fits any raid, so it can. */
  function finishable(data, q, { done = {}, radius = RADIUS } = {}) {
    if (q.onMap === false) return false;
    const zones = data.zones || {}, { serves } = geometry(zones, radius), spots = located(q, zones, done);
    return !spots.length || spots.some(o => o.zone.some(seed => zones[seed] && spots.every(x => serves(seed, x))));
  }

  function plan(data, quests, { done = {}, aim = "quests", radius = RADIUS, limit = MAX_RAIDS, whole = false } = {}) {
    aim = normalizeAim(aim);
    const zones = data.zones || {};
    const { distance, here, serves } = geometry(zones, radius);
    const work = quests.map(q => ({ q, spots: located(q, zones, done) }));
    let left = work.filter(w => w.spots.length);
    const raids = [], trader = aim.startsWith("rep:") ? aim.slice(4) : null;
    // An area can centre on any quest spot on the map, not just the chosen quests' own: two quests at either
    // end of the Resort share it only from a spot between them. Without the map's quests, any zone can.
    const seeds = [...new Set(data.quests ? data.quests.flatMap(q => (q.objectives || []).filter(o => !o.optional).flatMap(o => o.zone || [])) : Object.keys(zones))].filter(z => zones[z]).sort();
    while (raids.length < limit) {
      let best = null;
      for (const seed of seeds) {
        // whole: only quests this area finishes, for the Finishes here filter.
        const members = left.map(w => ({ ...w, served: w.spots.filter(o => serves(seed, o)) })).filter(w => whole ? w.served.length === w.spots.length && w.q.onMap !== false : w.served.length);
        if (members.length < MIN_QUESTS) continue;
        // A quest counts by the share of its located work that's here: one of four ambulances is a quarter of a quest.
        const score = members.reduce((sum, w) => sum + worth(w.q, aim) * w.served.length / w.spots.length, 0);
        // Equal groups take the most central spot, so the card's name fits the area.
        const spread = members.reduce((sum, w) => sum + w.served.reduce((s, o) => s + Math.min(...here(seed, o).map(z => distance(seed, z))), 0), 0);
        const better = !best || score > best.score + 1e-9 || (score > best.score - 1e-9 && (members.length > best.members.length || (members.length === best.members.length && spread < best.spread - 1e-9)));
        if (better) best = { seed, members, score, spread };
      }
      if (!best) break;
      const { seed, members, score } = best;
      raids.push({ id: seed, name: zones[seed].name, score, ids: members.map(w => id(w.q)), quests: members.map(w => w.q),
        finish: members.filter(w => w.served.length === w.spots.length && w.q.onMap !== false).map(w => id(w.q)),
        xp: members.reduce((sum, w) => sum + (w.q.rewards?.xp || 0), 0), rep: members.reduce((sum, w) => sum + standing(w.q, trader), 0),
        keys: [...new Set(members.flatMap(w => keysOf(w.q)))], zones: [...new Set(members.flatMap(w => w.served.flatMap(o => here(seed, o))))] });
      left = left.filter(w => !members.some(m => m.q === w.q));
    }
    raids.sort((a, b) => b.score - a.score || b.ids.length - a.ids.length || a.id.localeCompare(b.id));
    return { raids, anyRaid: work.filter(w => !w.spots.length).map(w => w.q), elsewhere: left.map(w => w.q) };
  }

  // Quests with no fixed spot left. They fit any raid, so choosing a raid doesn't drop them.
  const flexible = (data, quests, done = {}) => quests.filter(q => !located(q, data.zones || {}, done).length).map(id);
  // The selection for a raid: its quests, plus any flexible quests already chosen.
  function choose(raid, selected, flexibleIds) {
    return [...new Set([...raid.ids, ...selected.filter(q => flexibleIds.includes(q))])];
  }
  // A raid's button reads as chosen when nothing else with a spot is selected.
  const chosen = (raid, selected, flexibleIds) => raid.ids.every(q => selected.includes(q)) &&
    selected.every(q => raid.ids.includes(q) || flexibleIds.includes(q));

  const finishText = raid => !raid.finish.length ? "none finish here" : raid.finish.length === 1 ? "1 finishes here" : `${raid.finish.length} finish here`;

  // The remembered aim. Storage may be blocked, so a failed read means the default.
  function loadAim() { try { return normalizeAim(localStorage.getItem(AIM_KEY)); } catch (e) { return "quests"; } }
  function saveAim(aim) { try { localStorage.setItem(AIM_KEY, normalizeAim(aim)); } catch (e) {} }

  return { RADIUS, AIMS, normalizeAim, plan, finishable, flexible, choose, chosen, finishText, standing, keysOf, loadAim, saveAim };
});
