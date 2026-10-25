/* Site-bar quest search: Ctrl+K (or / on the home page) from anywhere. Shared by the home page
   and the map pages; the ranking lives in site-search.js. The index for the page's mode loads on
   first open. A map page sets window.SITE_HERE = { key, open } so its own quests open in place. */
(function () {
  const btn = document.getElementById("siteSearchBtn"), dlg = document.getElementById("siteSearch");
  if (!btn || !dlg || !window.SiteSearch) return;
  const input = document.getElementById("ssInput"), list = document.getElementById("ssList"), note = document.getElementById("ssNote");
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const indexes = {}, filters = { kappa: false, active: false, trader: "", map: "" }, PAGE = 40;
  const traderSel = document.getElementById("ssTrader"), mapSel = document.getElementById("ssMap"), more = document.getElementById("ssMore");
  let results = [], total = 0, shown = PAGE, active = 0, entries = null, statuses = {}, ssEntry = null, enterEarly = false;
  const mode = () => document.querySelector('.mode-toggle [aria-current="page"]')?.dataset.mode || "regular";
  const STATUS = { started: "Started", completed: "Completed", failed: "Failed" };
  const faction = typeof DATA !== "undefined" ? DATA?.meta?.player?.faction || DATA?.player?.faction || null : null;
  const otherSide = e => faction && e.faction && e.faction !== "Any" && e.faction !== faction;

  // Your quest statuses for this mode's active profile, if the tracker is on this page.
  function readStatuses() {
    try {
      const store = JSON.parse(localStorage.getItem(ProgressStore.STORAGE_KEY));
      const key = store?.active?.[mode()];
      if (!key || store.version !== 2) return {};
      return Object.fromEntries(Object.entries(ProgressStore.derive(store, key).statuses).map(([id, s]) => [id, s.status]));
    } catch (e) { return {}; }
  }
  function load() {
    const m = mode();
    indexes[m] ??= fetch(btn.dataset["index" + (m === "pve" ? "Pve" : "Pvp")]).then(r => r.ok ? r.json() : Promise.reject(new Error(r.status)));
    return indexes[m];
  }
  function hl(text) {
    const t = SiteSearch.terms(input.value);
    if (!t.length) return esc(text);
    // Match on folded text but mark the original letters (folding keeps one character per letter).
    const folded = SiteSearch.fold(text), marks = new Array(text.length).fill(false);
    for (const w of t) for (let i = folded.indexOf(w); i >= 0; i = folded.indexOf(w, i + 1)) marks.fill(true, i, i + w.length);
    if (folded.length !== text.length) return esc(text);
    let out = "", open = false;
    [...text].forEach((c, i) => { if (marks[i] !== open) { out += open ? "</mark>" : "<mark>"; open = marks[i]; } out += esc(c); });
    return out + (open ? "</mark>" : "");
  }
  const here = () => window.SITE_HERE || {};
  function target(e, m) {
    m = m || SiteSearch.primaryMap(e, here().key, filters.map);
    return m && { m, local: m.key === here().key && here().mode === mode(), href: btn.dataset.root + m.href + "#quest=" + e.id };
  }
  // "Listed on" is the in-game map list; "Also on" maps only have objectives.
  function mapLinks(e, t) {
    const link = m => `<a href="${esc(btn.dataset.root + m.href + "#quest=" + e.id)}" data-map="${esc(m.key)}" class="${m === t?.m ? "primary" : ""}${m.onMap ? "" : " multi"}" title="${m.onMap ? `Listed on ${esc(m.name)} in game` : `Has objectives on ${esc(m.name)}`}">${hl(m.name)}</a>`;
    const listed = (e.maps || []).filter(m => m.onMap), others = (e.maps || []).filter(m => !m.onMap);
    return (listed.length ? `<span class="ss-maplabel">Listed on</span>${listed.map(link).join("")}` : "") +
      (others.length ? `<span class="ss-maplabel">${listed.length ? "Also on" : "Objectives on"}</span>${others.map(link).join("")}` : "");
  }
  // Trader and map choices come from this mode's index; a choice that no longer exists is cleared.
  function fillFilters() {
    const { traders, maps } = SiteSearch.facets(entries);
    if (filters.trader && !traders.includes(filters.trader)) filters.trader = "";
    if (filters.map && filters.map !== "none" && !maps.some(m => m.key === filters.map)) filters.map = "";
    traderSel.innerHTML = `<option value="">Any trader</option>` + traders.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
    mapSel.innerHTML = `<option value="">Any map</option>` + maps.map(m => `<option value="${esc(m.key)}">${esc(m.name)}</option>`).join("") + `<option value="none">No map objectives</option>`;
    traderSel.value = filters.trader; mapSel.value = filters.map;
  }
  function render() {
    if (!entries) return;
    ({ items: results, total } = SiteSearch.browse(entries, input.value, { statuses, filters, faction, limit: shown }));
    active = Math.min(active, Math.max(0, results.length - 1));
    const q = input.value.trim(), listing = filters.kappa || filters.trader || filters.map;
    const count = total > results.length ? `Showing ${results.length} of ${total}` : `${total} ${total === 1 ? "quest" : "quests"}`;
    note.textContent = !results.length
      ? (q ? `No quests match “${q}”${listing ? " with these filters" : ""}.` : listing ? "No quests match these filters."
        : "Type a quest, or choose a trader or map. Your started quests show here once the tracker has your profile.")
      : !q && !listing ? `Your started quests · ${count}` : count;
    more.hidden = total <= results.length;
    more.textContent = `Show ${Math.min(PAGE, total - results.length)} more`;
    list.innerHTML = results.map((e, i) => {
      const t = target(e), st = statuses[e.id];
      const tags = [e.trader, e.minLevel > 1 && `Lvl ${e.minLevel}`, e.faction && e.faction !== "Any" && `${e.faction} only`].filter(Boolean).map(esc).join(" · ");
      return `<li role="option" id="ss-o${i}" class="ss-row${otherSide(e) ? " other-side" : ""}" data-i="${i}" aria-selected="${i === active}">
        <div class="ss-main"><span class="ss-name">${hl(e.name)}</span>${st ? `<span class="qst ${st}">${STATUS[st]}</span>` : ""}${e.kappa ? `<span class="kmark" title="Needed for Kappa">K</span>` : ""}${e.placeholder ? `<span class="ss-new">New</span>` : ""}</div>
        <div class="ss-meta"><span>${tags}</span>${t ? "" : `<span>No map objectives</span>`}</div>
        <div class="ss-maps">${mapLinks(e, t)}${e.wiki ? `<a href="${esc(e.wiki)}" target="_blank" rel="noopener" class="wiki">Wiki ↗</a>` : ""}</div>
      </li>`;
    }).join("");
    input.setAttribute("aria-activedescendant", results.length ? `ss-o${active}` : "");
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }
  function go(i, mapKey) {
    const e = results[i]; if (!e) return;
    const t = target(e, mapKey && e.maps.find(m => m.key === mapKey));
    if (!t) { if (e.wiki) window.open(e.wiki, "_blank", "noopener"); return; }
    if (t.local) {
      // Hand the search's history entry to the quest panel instead of going Back first, which
      // would land after the panel's own entry and close it again.
      ssEntry = null; close();
      try { history.replaceState(null, ""); } catch (err) {}
      here().open(e.id); return;
    }
    location.href = t.href;
  }
  async function open() {
    if (dlg.open) return input.select();
    statuses = readStatuses();
    document.getElementById("ssMode").textContent = mode() === "pve" ? "PvE" : "PvP";
    dlg.showModal(); input.select();
    ssEntry = Date.now() + Math.random(); // Back closes the search, as on a phone
    try { history.pushState({ siteSearch: ssEntry }, ""); } catch (e) {}
    entries = null; enterEarly = false; note.textContent = "Loading every quest…"; list.innerHTML = "";
    try { entries = await load(); fillFilters(); render(); if (enterEarly && input.value.trim()) go(0); }
    catch (e) { indexes[mode()] = null; note.textContent = "Couldn't load the quest list. Check your connection, then try again."; }
  }
  function close() { if (dlg.open) dlg.close(); }
  dlg.addEventListener("close", () => { if (ssEntry !== null && history.state?.siteSearch === ssEntry) history.back(); ssEntry = null; btn.focus({ preventScroll: true }); });
  window.addEventListener("popstate", () => { if (dlg.open && history.state?.siteSearch !== ssEntry) { ssEntry = null; close(); } });
  btn.addEventListener("click", open);
  input.addEventListener("input", () => { active = 0; shown = PAGE; render(); });
  for (const [sel, key] of [[traderSel, "trader"], [mapSel, "map"]]) sel.addEventListener("change", () => { filters[key] = sel.value; active = 0; shown = PAGE; render(); });
  more.addEventListener("click", () => {
    const first = results.length; shown += PAGE; render();
    // Keep keyboard users in place: the first newly shown result becomes the active one.
    active = Math.min(first, results.length - 1); render(); (more.hidden ? input : more).focus();
  });
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); active = (active + (e.key === "ArrowDown" ? 1 : -1) + results.length) % Math.max(1, results.length); render(); }
    if (e.key === "Enter") { e.preventDefault(); if (entries) go(active); else enterEarly = true; } // typed fast: open once loaded
  });
  dlg.addEventListener("click", e => {
    if (e.target === dlg || e.target.closest("[data-ss='close']")) return close();
    const f = e.target.closest("[data-ss-f]");
    if (f) { filters[f.dataset.ssF] = !filters[f.dataset.ssF]; f.setAttribute("aria-pressed", String(filters[f.dataset.ssF])); active = 0; shown = PAGE; render(); input.focus(); return; }
    const a = e.target.closest("a[data-map]"), row = e.target.closest(".ss-row");
    if (a && row && !(e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1)) { e.preventDefault(); go(+row.dataset.i, a.dataset.map); return; }
    if (row && !e.target.closest("a")) go(+row.dataset.i);
  });
  list.addEventListener("pointermove", e => {
    const row = e.target.closest(".ss-row");
    if (row && +row.dataset.i !== active) { active = +row.dataset.i; list.querySelectorAll(".ss-row").forEach(r => r.setAttribute("aria-selected", String(+r.dataset.i === active))); }
  });
  document.addEventListener("keydown", e => {
    const typing = e.target.closest?.("input, textarea, select, [contenteditable]");
    if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey) && !e.altKey) { e.preventDefault(); open(); }
    // "/" searches the site from pages without their own quest search.
    else if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !document.getElementById("questSearch") && !document.querySelector("dialog[open]")) { e.preventDefault(); open(); }
  });
  btn.querySelector("kbd").textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";
})();
