/* One quest filter for the whole site: within traders or objective kinds any choice counts; Kappa,
   Easy, No keys and the kinds narrow each other. It filters lists and suggestions, never a raid's
   selection, and lasts for this tab's session, so a forgotten filter doesn't return tomorrow. Shared
   by the home cards, the plan panel, the Quests tab, raid mode and site search. Pure helpers are
   tested; the chip bar and storage run only in a browser. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.QuestFilter = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const KEY = "eft-quest-filter", LIMIT = 5;
  // From each quest's effort facts (scripts/effort.py).
  const KINDS = { combat: "Combat", pickup: "Pickups", place: "Mark & place" };
  const empty = () => ({ traders: [], kappa: false, easy: false, noKeys: false, kinds: [] });
  function normalize(value) {
    const traders = Array.isArray(value?.traders) ? [...new Set(value.traders.filter(t => typeof t === "string" && t))].sort() : [];
    const kinds = Array.isArray(value?.kinds) ? [...new Set(value.kinds.filter(k => Object.hasOwn(KINDS, k)))].sort() : [];
    return { traders, kappa: value?.kappa === true, easy: value?.easy === true, noKeys: value?.noKeys === true, kinds };
  }
  const active = f => f.traders.length > 0 || f.kappa || f.easy || f.noKeys || f.kinds.length > 0;
  // A quest with no effort facts has unknown keys and kinds, so it doesn't match those chips.
  const keyFree = q => q.effort ? !q.effort.keys?.length : false;
  // Prapor + Jaeger + Kappa = Kappa quests from either trader. Easy needs quest.easy, which each
  // page sets from QuestEffort with the player's level.
  const matches = (quest, f) => (!f.traders.length || f.traders.includes(quest.trader)) && (!f.kappa || quest.kappa === true) &&
    (!f.easy || quest.easy === true) && (!f.noKeys || keyFree(quest)) && (!f.kinds?.length || f.kinds.some(k => quest.effort?.kinds?.includes(k)));
  const flip = (list, value) => list.includes(value) ? list.filter(x => x !== value) : [...list, value];
  const toggleTrader = (f, name) => normalize({ ...f, traders: flip(f.traders, name) });
  const toggleKind = (f, kind) => normalize({ ...f, kinds: flip(f.kinds, kind) });
  const toggleKappa = f => ({ ...f, kappa: !f.kappa });
  const toggleEasy = f => ({ ...f, easy: !f.easy });
  const toggleNoKeys = f => ({ ...f, noKeys: !f.noKeys });
  const summary = f => [f.easy && "Easy", f.kappa && "Kappa", f.noKeys && "No keys", f.kinds.map(k => KINDS[k]).join(" or "), f.traders.join(" or ")].filter(Boolean).join(" · ");

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
      kappa: list.filter(q => q.kappa === true && rest(q, "kappa")).length, easy: list.filter(q => q.easy === true && rest(q, "easy")).length,
      noKeys: list.filter(q => keyFree(q) && rest(q, "noKeys")).length, kinds };
  }

  // Browser side: one filter for this tab's session, a change event, and the chip bar.
  let current = empty();
  const expanded = new Set(), opened = new Set();
  const store = () => { try { return typeof sessionStorage === "object" ? sessionStorage : null; } catch (e) { return null; } };
  function load() { try { current = normalize(JSON.parse(store()?.getItem(KEY))); } catch (e) { current = empty(); } return current; }
  function set(next) {
    current = normalize(next);
    try { store()?.setItem(KEY, JSON.stringify(current)); } catch (e) {}
    if (typeof window === "object") window.dispatchEvent(new Event("eft-quest-filter"));
  }
  const get = () => current;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  /** The chip bar's HTML, from counts(). id keeps each bar's More/Fewer state. With fold, the chips sit
   *  behind a summary that always names the active filter, so it's never on without saying so. */
  function html(id, c, { label = "Filter", fold = false } = {}) {
    const items = chipItems(current, c.traders, { expanded: expanded.has(id) });
    const chip = (attrs, on, text, count) => `<button type="button" class="qf-chip" ${attrs} aria-pressed="${on}">${esc(text)}${count == null ? "" : `<span>${count}</span>`}</button>`;
    const clear = active(current) ? `<button type="button" class="qf-more" data-qf="clear">Clear filter</button>` : "";
    const bar = `<div class="qf" role="group" aria-label="${esc(label)}" data-qf-bar="${esc(id)}">${fold ? "" : `<span class="qf-label">${esc(label)}</span>`}` +
      chip('data-qf="easy"', current.easy, "Easy", c.easy) + chip('data-qf="kappa"', current.kappa, "Kappa", c.kappa) + chip('data-qf="noKeys"', current.noKeys, "No keys", c.noKeys) +
      Object.entries(KINDS).map(([k, v]) => chip(`data-qf-kind="${k}"`, current.kinds.includes(k), v, c.kinds?.[k])).join("") +
      items.traders.map(t => chip(`data-qf-trader="${esc(t.name)}"`, t.on, t.name, t.count)).join("") +
      (items.foldable ? `<button type="button" class="qf-more" data-qf="more" aria-expanded="${expanded.has(id)}">${expanded.has(id) ? "Fewer" : `+${items.hidden} more`}</button>` : "") + (fold ? "" : clear) + `</div>`;
    if (!fold) return bar;
    return `<div class="qf-row"><details class="qf-fold" data-qf-fold="${esc(id)}" ${opened.has(id) ? "open" : ""}><summary>${esc(label)}${active(current) ? ` <b>${esc(summary(current))}</b>` : ""}</summary>${bar}</details>${clear}</div>`;
  }
  if (typeof document === "object" && typeof window === "object") {
    load();
    document.addEventListener("toggle", e => {
      const id = e.target.dataset?.qfFold; if (id == null) return;
      e.target.open ? opened.add(id) : opened.delete(id);
    }, true);
    document.addEventListener("click", e => {
      const el = e.target.closest?.("[data-qf], [data-qf-trader], [data-qf-kind]"); if (!el) return;
      const bar = el.closest("[data-qf-bar]")?.dataset.qfBar;
      if (el.dataset.qfTrader != null) return set(toggleTrader(current, el.dataset.qfTrader));
      if (el.dataset.qfKind != null) return set(toggleKind(current, el.dataset.qfKind));
      if (el.dataset.qf === "kappa") return set(toggleKappa(current));
      if (el.dataset.qf === "easy") return set(toggleEasy(current));
      if (el.dataset.qf === "noKeys") return set(toggleNoKeys(current));
      if (el.dataset.qf === "clear") return set(empty());
      if (el.dataset.qf === "more" && bar) {
        expanded.has(bar) ? expanded.delete(bar) : expanded.add(bar);
        window.dispatchEvent(new Event("eft-quest-filter"));
        document.querySelector(`[data-qf-bar="${CSS.escape(bar)}"] [data-qf="more"]`)?.focus();
      }
    });
  }
  return { KEY, KINDS, empty, normalize, active, matches, toggleTrader, toggleKind, toggleKappa, toggleEasy, toggleNoKeys, summary, chipItems, counts, load, set, get, html };
});
