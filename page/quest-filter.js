/* One quest filter for the whole site. Within traders or objective kinds any choice counts; the
   "Show only" flags narrow everything. It filters lists and suggestions, never a raid's selection,
   and lasts for this tab's session, so a forgotten filter doesn't return tomorrow. Shared by the home
   cards, the plan panel, the Quests tab, raid mode and site search. Pure helpers are tested; the bar
   and storage run only in a browser. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.QuestFilter = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const KEY = "eft-quest-filter", LIMIT = 5;
  // From each quest's effort facts (scripts/effort.py).
  const KINDS = { combat: "Combat", pickup: "Pickups", place: "Mark & place" };
  // Narrowing flags, in the order the panel shows them. ready and easy come from QuestEffort, set by each page.
  const FLAGS = { ready: ["Gear ready", "Every key and item it needs is yours, on the flea at your level, or sold by a trader"],
    easy: ["Easy", "Few spots, easy kills, keys you can buy"], kappa: ["Kappa", "Needed for the Kappa container"],
    noKeys: ["No keys", "Needs no key"] };
  const empty = () => ({ traders: [], kinds: [], ...Object.fromEntries(Object.keys(FLAGS).map(k => [k, false])) });
  function normalize(value) {
    const traders = Array.isArray(value?.traders) ? [...new Set(value.traders.filter(t => typeof t === "string" && t))].sort() : [];
    const kinds = Array.isArray(value?.kinds) ? [...new Set(value.kinds.filter(k => Object.hasOwn(KINDS, k)))].sort() : [];
    return { traders, kinds, ...Object.fromEntries(Object.keys(FLAGS).map(k => [k, value?.[k] === true])) };
  }
  const active = f => f.traders.length > 0 || f.kinds.length > 0 || Object.keys(FLAGS).some(k => f[k]);
  // A quest with no effort facts has unknown keys and kinds, so it doesn't match those chips.
  const keyFree = q => q.effort ? !q.effort.keys?.length : false;
  const flagged = { ready: q => q.ready === true, easy: q => q.easy === true, kappa: q => q.kappa === true, noKeys: keyFree };
  // Prapor + Jaeger + Kappa = Kappa quests from either trader.
  const matches = (quest, f) => (!f.traders?.length || f.traders.includes(quest.trader)) && Object.keys(FLAGS).every(k => !f[k] || flagged[k](quest)) &&
    (!f.kinds?.length || f.kinds.some(k => quest.effort?.kinds?.includes(k)));
  const flip = (list, value) => list.includes(value) ? list.filter(x => x !== value) : [...list, value];
  const toggleTrader = (f, name) => normalize({ ...f, traders: flip(f.traders, name) });
  const toggleKind = (f, kind) => normalize({ ...f, kinds: flip(f.kinds, kind) });
  const toggle = (f, flag) => Object.hasOwn(FLAGS, flag) ? { ...f, [flag]: !f[flag] } : f;
  const toggleKappa = f => toggle(f, "kappa"), toggleEasy = f => toggle(f, "easy"), toggleNoKeys = f => toggle(f, "noKeys");
  const summary = f => [...Object.keys(FLAGS).filter(k => f[k]).map(k => FLAGS[k][0]), f.kinds.map(k => KINDS[k]).join(" or "), f.traders.join(" or ")].filter(Boolean).join(" · ");

  /** Chips for one screen. traders: [{ name, count }] in that screen's order. Chosen traders always
   *  show; past `limit` the rest fold behind a toggle that reads "+n more" / "Fewer". */
  function chipItems(f, traders, { expanded = false, limit = LIMIT } = {}) {
    const all = [...traders];
    for (const name of f.traders) if (!all.some(t => t.name === name)) all.push({ name, count: 0 });
    const shown = expanded ? all : all.filter((t, i) => i < limit || f.traders.includes(t.name));
    return { traders: shown.map(t => ({ ...t, on: f.traders.includes(t.name) })), hidden: all.length - shown.length,
      foldable: all.length > limit && all.some((t, i) => i >= limit && !f.traders.includes(t.name)) };
  }

  /** Chip counts for a list: for each chip, the quests you'd see with the rest of the filter applied.
   *  Traders keep one order (most quests in the list, then name), so chips don't jump when another
   *  chip is toggled. */
  function counts(list, f) {
    f = normalize(f);
    const per = new Map(), size = new Map();
    const rest = (q, skip) => matches(q, { ...f, [skip]: Array.isArray(f[skip]) ? [] : false });
    for (const q of list) if (q.trader) {
      size.set(q.trader, (size.get(q.trader) || 0) + 1);
      per.set(q.trader, (per.get(q.trader) || 0) + (rest(q, "traders") ? 1 : 0));
    }
    const kinds = Object.fromEntries(Object.keys(KINDS).map(k => [k, list.filter(q => q.effort?.kinds?.includes(k) && rest(q, "kinds")).length]));
    return { traders: [...per].map(([name, count]) => ({ name, count })).sort((a, b) => size.get(b.name) - size.get(a.name) || a.name.localeCompare(b.name)),
      ...Object.fromEntries(Object.keys(FLAGS).map(k => [k, list.filter(q => flagged[k](q) && rest(q, k)).length])), kinds };
  }

  // Browser side: one filter for this tab's session, a change event, and the bar.
  let current = empty();
  const opened = new Set();
  const store = () => { try { return typeof sessionStorage === "object" ? sessionStorage : null; } catch (e) { return null; } };
  function load() { try { current = normalize(JSON.parse(store()?.getItem(KEY))); } catch (e) { current = empty(); } return current; }
  function set(next) {
    current = normalize(next);
    try { store()?.setItem(KEY, JSON.stringify(current)); } catch (e) {}
    if (typeof window === "object") window.dispatchEvent(new Event("eft-quest-filter"));
  }
  const get = () => current;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  /** The bar's HTML, from counts(): a Filter button, the active filters as chips that remove themselves,
   *  and a panel grouped by what each chip does. id keeps each bar's panel open across redraws. */
  function html(id, c, { label = "Filter" } = {}) {
    const open = opened.has(id), n = Object.keys(FLAGS).filter(k => current[k]).length + current.kinds.length + current.traders.length;
    const chip = (attrs, on, text, count, title = "") => `<button type="button" class="qf-chip" ${attrs} aria-pressed="${on}"${title ? ` title="${esc(title)}"` : ""}${!on && count === 0 ? " disabled" : ""}>${esc(text)}${count == null ? "" : `<span>${count}</span>`}</button>`;
    const token = (attrs, text) => `<button type="button" class="qf-token" ${attrs} aria-label="Remove filter: ${esc(text)}">${esc(text)}<span aria-hidden="true">×</span></button>`;
    const group = (title, hint, chips) => `<div class="qf-group"><span class="qf-glabel">${esc(title)}${hint ? ` <small>${esc(hint)}</small>` : ""}</span><div class="qf-chips">${chips}</div></div>`;
    const traders = chipItems(current, c.traders, { expanded: true }).traders;
    const tokens = [...Object.keys(FLAGS).filter(k => current[k]).map(k => token(`data-qf="${k}"`, FLAGS[k][0])),
      ...current.kinds.map(k => token(`data-qf-kind="${k}"`, KINDS[k])), ...current.traders.map(t => token(`data-qf-trader="${esc(t)}"`, t))].join("");
    return `<div class="qf" role="group" aria-label="${esc(label)}" data-qf-bar="${esc(id)}"><div class="qf-bar">` +
      `<button type="button" class="qf-btn" data-qf="menu" aria-expanded="${open}">${esc(label)}${n ? `<span>${n}</span>` : ""}<svg aria-hidden="true" viewBox="0 0 10 6" width="10" height="6"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button>` +
      tokens + (n > 1 ? `<button type="button" class="qf-more" data-qf="clear">Clear all</button>` : "") + `</div>` +
      `<div class="qf-panel"${open ? "" : " hidden"}>` +
      group("Show only", "", Object.entries(FLAGS).map(([k, [text, title]]) => chip(`data-qf="${k}"`, current[k], text, c[k], title)).join("")) +
      group("Objective", "any of", Object.entries(KINDS).map(([k, v]) => chip(`data-qf-kind="${k}"`, current.kinds.includes(k), v, c.kinds?.[k])).join("")) +
      (traders.length ? group("Trader", "any of", traders.map(t => chip(`data-qf-trader="${esc(t.name)}"`, t.on, t.name, t.count)).join("")) : "") +
      `<button type="button" class="qf-more" data-qf="menu">Done</button></div></div>`;
  }
  if (typeof document === "object" && typeof window === "object") {
    load();
    const refocus = (bar, selector) => document.querySelector(`[data-qf-bar="${CSS.escape(bar)}"] ${selector}`)?.focus();
    document.addEventListener("click", e => {
      const el = e.target.closest?.("[data-qf], [data-qf-trader], [data-qf-kind]"); if (!el) return;
      const bar = el.closest("[data-qf-bar]")?.dataset.qfBar, token = el.classList.contains("qf-token");
      if (el.dataset.qf === "menu" && bar) {
        opened.has(bar) ? opened.delete(bar) : opened.add(bar);
        window.dispatchEvent(new Event("eft-quest-filter"));
        return refocus(bar, '.qf-btn');
      }
      if (el.dataset.qfTrader != null) set(toggleTrader(current, el.dataset.qfTrader));
      else if (el.dataset.qfKind != null) set(toggleKind(current, el.dataset.qfKind));
      else if (el.dataset.qf === "clear") set(empty());
      else if (Object.hasOwn(FLAGS, el.dataset.qf)) set(toggle(current, el.dataset.qf));
      else return;
      // The bar was drawn again: keep the keyboard where it was.
      if (bar && !token) refocus(bar, `[${el.dataset.qfTrader != null ? `data-qf-trader="${CSS.escape(el.dataset.qfTrader)}"` : el.dataset.qfKind != null ? `data-qf-kind="${el.dataset.qfKind}"` : `data-qf="${el.dataset.qf}"`}]:not(.qf-token)`);
      else if (bar) refocus(bar, ".qf-btn");
    });
    document.addEventListener("keydown", e => {
      const bar = e.key === "Escape" && e.target.closest?.(".qf-panel") && e.target.closest("[data-qf-bar]")?.dataset.qfBar;
      if (!bar) return;
      e.stopPropagation(); opened.delete(bar);
      window.dispatchEvent(new Event("eft-quest-filter"));
      refocus(bar, ".qf-btn");
    });
  }
  return { KEY, KINDS, FLAGS, empty, normalize, active, matches, toggle, toggleTrader, toggleKind, toggleKappa, toggleEasy, toggleNoKeys, summary, chipItems, counts, load, set, get, html };
});
