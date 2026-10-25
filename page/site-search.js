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
    // "New Therapist quest (name pending)" matches a trader name in its own name; real quests first.
    return s + (STATUS_BOOST[status] || 0) - (otherSide ? 150 : 0) - (entry.placeholder ? 400 : 0) - name.length * 0.1;
  }

  // Filters: kappa, active (started), traders (any of these names) and map (a map key where the
  // quest has objectives, or "none" for quests without map objectives).
  function passes(e, filters, statuses) {
    const maps = e.maps || [];
    return (!filters.kappa || e.kappa) && (!filters.active || statuses[e.id] === "started") &&
      (!filters.traders?.length || filters.traders.includes(e.trader)) &&
      (!filters.map || (filters.map === "none" ? !maps.length : maps.some(m => m.key === filters.map)));
  }
  const STATUS_ORDER = { started: 0, completed: 2, failed: 3 };

  /** Ranked results with the full count: { items, total }. With no words and no filter it lists
   *  your started quests, so the box is useful on open. A trader, map or Kappa filter alone lists
   *  every match: started first, then quests the in-game list shows on the chosen map, then by
   *  name, with placeholders and finished quests last. statuses maps task ID -> status; faction
   *  (USEC/BEAR) sinks the other side's quests. */
  function browse(entries, query, { statuses = {}, filters = {}, faction = null, limit = 40 } = {}) {
    const words = terms(query), keep = e => passes(e, filters, statuses);
    let ranked;
    if (!words.length) {
      const listing = filters.kappa || filters.traders?.length || filters.map;
      const listedHere = e => filters.map && (e.maps || []).some(m => m.key === filters.map && m.onMap) ? 0 : 1;
      const otherSide = e => faction && e.faction && e.faction !== "Any" && e.faction !== faction ? 1 : 0;
      ranked = entries.filter(e => keep(e) && (listing || statuses[e.id] === "started")).sort((a, b) =>
        (STATUS_ORDER[statuses[a.id]] ?? 1) - (STATUS_ORDER[statuses[b.id]] ?? 1) || otherSide(a) - otherSide(b) ||
        Number(!!a.placeholder) - Number(!!b.placeholder) || listedHere(a) - listedHere(b) || a.name.localeCompare(b.name));
    } else {
      ranked = entries.filter(keep).map(e => [e, score(e, words, statuses[e.id], faction)]).filter(([, s]) => s !== null)
        .sort((a, b) => b[1] - a[1] || a[0].name.localeCompare(b[0].name)).map(([e]) => e);
    }
    return { items: ranked.slice(0, limit), total: ranked.length };
  }
  function search(entries, query, options = {}) { return browse(entries, query, options).items; }

  /** Trader and map choices for the filters, from the index itself. */
  function facets(entries) {
    const traders = [...new Set(entries.map(e => e.trader).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const maps = new Map();
    for (const e of entries) for (const m of e.maps || []) maps.set(m.key, m.name);
    return { traders, maps: [...maps].map(([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name)) };
  }

  /** Where a result opens: the map filter's map, else this page's map when the quest is on it,
   *  else the map whose in-game list shows it, else the first map with an objective. None for
   *  quests with no map objectives. */
  function primaryMap(entry, hereKey, preferKey = null) {
    const maps = entry.maps || [];
    return maps.find(m => m.key === preferKey) || maps.find(m => m.key === hereKey) || maps.find(m => m.onMap) || maps[0] || null;
  }

  return { fold, terms, search, browse, facets, primaryMap };
});
