/* Site-wide quest search over dist/search-index.json. Pure UMD; the site bar owns the DOM. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SiteSearch = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const fold = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const terms = query => fold(query).split(/\s+/).filter(Boolean);
  const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const STATUS_BOOST = { started: 60, completed: -40, failed: -60 };

  // Everything a player might type to find a quest: its name, trader, maps and a few tags.
  function haystack(entry) {
    return fold([entry.name, entry.trader, ...(entry.maps || []).map(m => m.name),
      entry.kappa && "kappa", entry.lightkeeper && "lightkeeper", entry.placeholder && "new"].filter(Boolean).join("\n"));
  }

  /** Score one entry, or null when a term matches nothing. Name matches beat trader/map matches;
   *  a whole-name or prefix match wins outright; your started quests rise, finished ones sink. */
  function score(entry, words, status, faction) {
    const name = fold(entry.name), hay = haystack(entry), phrase = words.join(" ");
    let s = 0;
    for (const w of words) {
      if (!hay.includes(w)) return null;
      // Outside the name: the trader, then a map whose in-game list shows the quest, then any map.
      s += new RegExp(`(^|[^a-z0-9])${escapeRe(w)}`).test(name) ? 40 : name.includes(w) ? 20
        : fold(entry.trader).includes(w) ? 8 : (entry.maps || []).some(m => m.onMap && fold(m.name).includes(w)) ? 10 : 3;
    }
    if (name === phrase) s += 1000;
    else if (name.startsWith(phrase)) s += 500;
    else if (new RegExp(`(^|[^a-z0-9])${escapeRe(phrase)}`).test(name)) s += 300;
    else if (name.includes(phrase)) s += 200;
    const otherSide = faction && entry.faction && entry.faction !== "Any" && entry.faction !== faction;
    return s + (STATUS_BOOST[status] || 0) - (otherSide ? 150 : 0) - name.length * 0.1;
  }

  /** Ranked results. An empty query lists your started quests, so the box is useful on open.
   *  filters: { kappa, active } narrow the list; statuses maps task ID -> started/completed/failed;
   *  faction (USEC/BEAR) sinks the other side's quests. */
  function search(entries, query, { statuses = {}, filters = {}, faction = null, limit = 40 } = {}) {
    const words = terms(query);
    const keep = e => (!filters.kappa || e.kappa) && (!filters.active || statuses[e.id] === "started");
    if (!words.length) {
      return entries.filter(e => keep(e) && (filters.kappa || statuses[e.id] === "started"))
        .sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit);
    }
    return entries.filter(keep).map(e => [e, score(e, words, statuses[e.id], faction)]).filter(([, s]) => s !== null)
      .sort((a, b) => b[1] - a[1] || a[0].name.localeCompare(b[0].name)).slice(0, limit).map(([e]) => e);
  }

  /** Where a result opens: this page's map when the quest is on it, else the map whose in-game
   *  list shows it, else the first map with an objective. None for quests with no map objectives. */
  function primaryMap(entry, hereKey) {
    const maps = entry.maps || [];
    return maps.find(m => m.key === hereKey) || maps.find(m => m.onMap) || maps[0] || null;
  }

  return { fold, terms, search, primaryMap };
});
