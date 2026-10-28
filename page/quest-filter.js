/* One quest filter for the whole site: traders widen (any chosen trader), Kappa and Easy narrow.
   Remembered per browser and shared by the home cards, the Quests tab, the raid picker, raid mode
   and site search. Pure helpers are tested; the chip bar and storage run only in a browser. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.QuestFilter = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const KEY = "eft-quest-filter", LIMIT = 5;
  const empty = () => ({ traders: [], kappa: false, easy: false });
  function normalize(value) {
    const traders = Array.isArray(value?.traders) ? [...new Set(value.traders.filter(t => typeof t === "string" && t))].sort() : [];
    return { traders, kappa: value?.kappa === true, easy: value?.easy === true };
  }
  const active = f => f.traders.length > 0 || f.kappa || f.easy;
  // Prapor + Jaeger + Kappa = Kappa quests from either trader. Easy needs quest.easy, which each
  // page sets from QuestEffort with the player's level.
  const matches = (quest, f) => (!f.traders.length || f.traders.includes(quest.trader)) && (!f.kappa || quest.kappa === true) &&
    (!f.easy || quest.easy === true);
  function toggleTrader(f, name) {
    const traders = f.traders.includes(name) ? f.traders.filter(t => t !== name) : [...f.traders, name];
    return normalize({ ...f, traders });
  }
  const toggleKappa = f => ({ ...f, kappa: !f.kappa });
  const toggleEasy = f => ({ ...f, easy: !f.easy });
  const summary = f => [f.easy && "Easy", f.kappa && "Kappa", f.traders.join(" or ")].filter(Boolean).join(" · ");

  /** Chips for one screen. traders: [{ name, count }] in that screen's order. Chosen traders always
   *  show; past `limit` the rest fold behind a toggle that reads "+n more" / "Fewer". */
  function chipItems(f, traders, { expanded = false, limit = LIMIT } = {}) {
    const all = [...traders];
    for (const name of f.traders) if (!all.some(t => t.name === name)) all.push({ name, count: 0 });
    const shown = expanded ? all : all.filter((t, i) => i < limit || f.traders.includes(t.name));
    return { traders: shown.map(t => ({ ...t, on: f.traders.includes(t.name) })), hidden: all.length - shown.length,
      foldable: all.length > limit && all.some((t, i) => i >= limit && !f.traders.includes(t.name)) };
  }

  /** Chip counts for a list: per trader, the quests you'd see with Kappa applied; for Kappa, the
   *  Kappa quests among the chosen traders. Traders keep one order (most quests in the list, then
   *  name), so chips don't jump when Kappa is toggled. */
  function counts(list, f) {
    const per = new Map(), size = new Map();
    const rest = (q, skip) => matches(q, { ...f, traders: skip === "traders" ? [] : f.traders, kappa: skip === "kappa" ? false : f.kappa, easy: skip === "easy" ? false : f.easy });
    for (const q of list) if (q.trader) {
      size.set(q.trader, (size.get(q.trader) || 0) + 1);
      per.set(q.trader, (per.get(q.trader) || 0) + (rest(q, "traders") ? 1 : 0));
    }
    return { traders: [...per].map(([name, count]) => ({ name, count })).sort((a, b) => size.get(b.name) - size.get(a.name) || a.name.localeCompare(b.name)),
      kappa: list.filter(q => q.kappa === true && rest(q, "kappa")).length, easy: list.filter(q => q.easy === true && rest(q, "easy")).length };
  }

  // Browser side: one remembered filter, a change event, and the chip bar.
  let current = empty();
  const expanded = new Set();
  const store = () => { try { return typeof localStorage === "object" ? localStorage : null; } catch (e) { return null; } };
  function load() { try { current = normalize(JSON.parse(store()?.getItem(KEY))); } catch (e) { current = empty(); } return current; }
  function set(next) {
    current = normalize(next);
    try { store()?.setItem(KEY, JSON.stringify(current)); } catch (e) {}
    if (typeof window === "object") window.dispatchEvent(new Event("eft-quest-filter"));
  }
  const get = () => current;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  /** The chip bar's HTML. id keeps each bar's More/Fewer state; kappaCount is optional. */
  function html(id, traders, { kappaCount = null, easyCount = null, label = "Filter" } = {}) {
    const items = chipItems(current, traders, { expanded: expanded.has(id) });
    const chip = (attrs, on, text, count) => `<button type="button" class="qf-chip" ${attrs} aria-pressed="${on}">${esc(text)}${count == null ? "" : `<span>${count}</span>`}</button>`;
    return `<div class="qf" role="group" aria-label="${esc(label)}: traders widen, Kappa narrows" data-qf-bar="${esc(id)}"><span class="qf-label">${esc(label)}</span>` +
      chip('data-qf="easy"', current.easy, "Easy", easyCount) + chip('data-qf="kappa"', current.kappa, "Kappa", kappaCount) +
      items.traders.map(t => chip(`data-qf-trader="${esc(t.name)}"`, t.on, t.name, t.count)).join("") +
      (items.foldable ? `<button type="button" class="qf-more" data-qf="more" aria-expanded="${expanded.has(id)}">${expanded.has(id) ? "Fewer" : `+${items.hidden} more`}</button>` : "") +
      (active(current) ? `<button type="button" class="qf-more" data-qf="clear">Clear filter</button>` : "") + `</div>`;
  }
  if (typeof document === "object" && typeof window === "object") {
    load();
    document.addEventListener("click", e => {
      const el = e.target.closest?.("[data-qf], [data-qf-trader]"); if (!el) return;
      const bar = el.closest("[data-qf-bar]")?.dataset.qfBar;
      if (el.dataset.qfTrader != null) return set(toggleTrader(current, el.dataset.qfTrader));
      if (el.dataset.qf === "kappa") return set(toggleKappa(current));
      if (el.dataset.qf === "easy") return set(toggleEasy(current));
      if (el.dataset.qf === "clear") return set(empty());
      if (el.dataset.qf === "more" && bar) {
        expanded.has(bar) ? expanded.delete(bar) : expanded.add(bar);
        window.dispatchEvent(new Event("eft-quest-filter"));
        document.querySelector(`[data-qf-bar="${CSS.escape(bar)}"] [data-qf="more"]`)?.focus();
      }
    });
    // Another tab changed it: follow along.
    window.addEventListener("storage", e => { if (e.key === KEY) { load(); window.dispatchEvent(new Event("eft-quest-filter")); } });
  }
  return { KEY, empty, normalize, active, matches, toggleTrader, toggleKappa, toggleEasy, summary, chipItems, counts, load, set, get, html };
});
