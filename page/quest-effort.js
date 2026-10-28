/* Easy wins: judges a quest's effort facts (scripts/effort.py) with the player's level.
   Pure UMD; a heuristic, so it always says why. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.QuestEffort = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const MAX_SPOTS = 2, MAX_KILLS = 5;
  // A key you can buy now: on the flea at your level, or for cash from a trader.
  const buyable = (k, level) => k.trader || (k.fleaLevel != null && level != null && k.fleaLevel <= level);
  /** { easy, score, reasons } — reasons explain an easy win, or name what blocks it. Lower score = less work. */
  function assess(f, { level = null } = {}) {
    if (!f) return { easy: false, score: Infinity, reasons: ["No effort data"] };
    const blockers = [];
    for (const k of f.keys) if (!buyable(k, level)) {
      blockers.push(k.fleaLevel == null ? `${k.name} isn't sold on the flea` : `${k.name} needs flea level ${k.fleaLevel}`);
    }
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
      f.keys.length ? `${f.keys.length === 1 ? "key" : "keys"} buyable` : "no key", f.kills ? `${f.kills} scav kills` : "no kills"];
    return { easy: true, score, reasons };
  }
  return { assess, buyable, MAX_SPOTS, MAX_KILLS };
});
