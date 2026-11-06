/* Easy wins and gear: judges a quest's effort facts (scripts/effort.py) with the player's level and the
   gear they've ticked as owned. Pure UMD; a heuristic, so it always says why. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.QuestEffort = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const MAX_SPOTS = 2, MAX_KILLS = 5;
  const CASH = /^[A-Z][A-Za-z ]+ LL\d: [\d,]+/, BARTER = /^[A-Z][A-Za-z ]+ LL\d barter:/;

  /** How you'd get one key or item before the raid. ok: you can have it before you load in.
   *  how: have (ticked as owned), flea (open at your level), trader (sold for cash), barter, or find. */
  function gear(g, { level = null, have = {} } = {}) {
    if (g.id && have[g.id]) return { ok: true, how: "have", label: "you have it" };
    if (g.fleaLevel != null && level != null && g.fleaLevel <= level) return { ok: true, how: "flea", label: "flea" };
    if (g.trader) return { ok: true, how: "trader", label: "trader" };
    const later = g.fleaLevel != null ? `, flea at level ${g.fleaLevel}` : "";
    return g.barter ? { ok: false, how: "barter", label: "barter only" + later } : { ok: false, how: "find", label: "find in raid" + later };
  }
  // A map page's acquisition row, in the effort facts' gear shape.
  const fromAcquisition = a => ({ id: a.itemId, name: a.item, kind: a.kind, fleaLevel: a.fleaLevel ?? null,
    trader: (a.sources || []).some(s => CASH.test(s)), barter: (a.sources || []).some(s => BARTER.test(s)) });
  const buyable = (k, level, have) => gear(k, { level, have }).ok;

  /** Every required key and item with its status. ready: all of it can be had before the raid.
   *  Unknown facts (a placeholder quest) are never ready. */
  function readiness(f, opts = {}) {
    if (!f) return { ready: false, known: false, gear: [], blocked: [] };
    const all = [...f.keys.map(k => ({ kind: "key", ...k })), ...(f.items || []).map(i => ({ kind: "item", ...i }))].map(g => ({ ...g, ...gear(g, opts) }));
    const blocked = all.filter(g => !g.ok);
    return { ready: !blocked.length, known: true, gear: all, blocked };
  }

  /** { easy, score, reasons } — reasons explain an easy win, or name what blocks it. Lower score = less work. */
  function assess(f, { level = null, have = {} } = {}) {
    if (!f) return { easy: false, score: Infinity, reasons: ["No effort data"] };
    const blockers = [];
    for (const k of f.keys) if (!buyable(k, level, have)) {
      blockers.push(k.fleaLevel == null ? `${k.name} isn't sold on the flea` : `${k.name} needs flea level ${k.fleaLevel}`);
    }
    for (const i of f.items || []) { const g = gear(i, { level, have }); if (!g.ok) blockers.push(`${i.name}: ${g.label}`); }
    if (f.hardKills) blockers.push("PMC, boss or Rogue kills");
    if (f.kills > MAX_KILLS) blockers.push(`${f.kills} kills`);
    if (f.fir) blockers.push("found-in-raid hand-in");
    if (f.streak) blockers.push("several extracts in a row");
    if (f.grind) blockers.push("skill or reputation grind");
    if (f.maps > 1) blockers.push(`${f.maps} maps`);
    if (f.spots > MAX_SPOTS) blockers.push(`${f.spots} spots`);
    if (f.unlocated) blockers.push(f.unlocated === 1 ? "a place the map doesn't show" : `${f.unlocated} places the map doesn't show`);
    const score = f.spots + (f.unlocated || 0) * 2 + f.kills / MAX_KILLS + f.keys.length + f.maps + blockers.length * 3;
    if (blockers.length) return { easy: false, score, reasons: blockers };
    const reasons = [f.spots ? `${f.spots} ${f.spots === 1 ? "spot" : "spots"}` : f.extracts ? "just extract" : "no spots to visit",
      f.keys.length ? `${f.keys.length === 1 ? "key" : "keys"} ${f.keys.some(k => have[k.id]) ? "in hand or buyable" : "buyable"}` : "no key", f.kills ? `${f.kills} scav kills` : "no kills"];
    return { easy: true, score, reasons };
  }

  const who = targets => !targets?.length ? "targets" : targets.some(t => /pmc/i.test(t)) ? "PMCs"
    : targets.every(t => /^(scavs?|sniper)$/i.test(t)) ? "Scavs" : targets[0];
  /** What's left to do on this map, in a few words: "3 spots · kill 10 Scavs · extract".
   *  done(objective) says whether an objective is finished; optional ones never count. */
  function todo(q, done = () => false) {
    const left = (q.objectives || []).filter(o => !o.optional && !done(o));
    const parts = [], spots = new Set(left.flatMap(o => o.zone || [])).size;
    if (spots) parts.push(`${spots} ${spots === 1 ? "spot" : "spots"}`);
    for (const o of left.filter(o => o.type === "shoot")) parts.push(`kill ${o.count || 1} ${who(o.targets)}`);
    const hand = left.filter(o => ["giveItem", "giveQuestItem"].includes(o.type));
    if (hand.length) parts.push(hand.some(o => o.foundInRaid) ? "hand in found-in-raid items" : "hand in items");
    const loot = left.filter(o => o.type === "findItem" && !o.zone?.length);
    if (loot.length && !hand.length) parts.push(loot.some(o => o.foundInRaid) ? "find items in raid" : "find items");
    const out = left.filter(o => o.type === "extract");
    if (out.length) parts.push(out.some(o => (o.count || 1) > 1) ? `extract ${Math.max(...out.map(o => o.count || 1))} times` : "extract");
    if (left.some(o => ["experience", "skill", "traderLevel", "traderStanding"].includes(o.type))) parts.push("level a skill or trader");
    return parts.length ? parts.join(" · ") : left.length ? "other objectives" : "nothing left here";
  }

  // "Any of: A, B, C (+5 more)" from tarkov.dev reads as "A or similar" in a chip.
  const shortName = name => String(name).replace(/^Any of: (.+?)(, .*| \(\+\d+ more\))$/, "$1 or similar");

  return { assess, buyable, shortName, gear, fromAcquisition, readiness, todo, MAX_SPOTS, MAX_KILLS };
});
