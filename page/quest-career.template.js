/* Shared Keep/Kappa UI on home and map pages. Facts and decisions live in QuestCareer. */
(function () {
  const button = document.getElementById("careerButton"), dialog = document.getElementById("careerDialog");
  if (!button) return;
  const body = document.getElementById("careerBody"), root = button.dataset.root;
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const cache = {};
  let view = "kappa", latest = null, generation = 0, timer;
  function context() {
    let store;
    try { store = JSON.parse(localStorage.getItem(ProgressStore.STORAGE_KEY)); } catch (e) {}
    if (store?.version !== 2) store = ProgressStore.empty();
    const mode = document.querySelector('.mode-toggle [aria-current="page"]')?.dataset.mode || "regular";
    const key = store.active[mode], scope = store.scopes[key]?.mode === mode ? store.scopes[key] : null;
    const defaults = DATA.meta?.player || DATA.player || {};
    let level = defaults.level || 1;
    try { const saved = Number(localStorage.getItem(`eft-player-level:${key}`)); if (Number.isInteger(saved) && saved >= 1 && saved <= 100) level = saved; } catch (e) {}
    return { store, mode, key, scope, level, faction: defaults.faction || "USEC" };
  }
  const mapLinks = t => t.maps.length ? t.maps.map(m => `<a data-career-quest="${esc(t.id)}" data-career-map="${esc(m.key)}" href="${esc(root + m.href + '#quest=' + t.id)}">${esc(m.name)}</a>`).join(" · ") : t.wiki ? `<a href="${esc(t.wiki)}" target="_blank" rel="noopener">Wiki ↗</a>` : "No map objectives";
  const loyalty = t => (t.traderRequirements || []).map(r => `needs ${r.trader} ${r.type === 'level' ? 'LL' : r.type + ' '}${r.value} (unverified)`).join(" · ");
  function reason(r, data) {
    const name = id => data.tasks.find(t => t.id === id)?.name || id;
    if (r.type === "level") return `Needs level ${r.level}`;
    if (r.type === "prerequisite") return `${r.statuses.includes('failed') ? 'Needs failed' : r.statuses.includes('active') ? 'Accept' : 'After'} ${name(r.task)}`;
    if (r.type === "anyOf") return 'Needs one of: ' + r.requirements.map(req => name(req.task)).join(" / ");
    if (r.type === "faction") return `${r.faction} only`;
    if (r.type === "failed") return "Failed · cannot restart";
    return r.name ? `Unresolved requirement: ${r.name}` : "No current acceptance recorded";
  }
  function collectorHTML(result, ctx) {
    if (!result.collector.length) return '<p class="map-note">Collector item data is unavailable for this mode.</p>';
    return `<details data-career-section="collector"><summary>The Collector · ${result.collector.filter(o => o.checked).length} / ${result.collector.length} handed in</summary>
      <p class="map-note">Tick items after handing them in. Logs do not record item hand-ins. Saved for this profile, mode and wipe.</p>
      <div class="collector-grid">${result.collector.map(o => `<label class="collector-item"><input type="checkbox" data-collector="${esc(o.id)}" ${o.checked ? 'checked' : ''} ${!ctx.scope || result.quests[o.quest]?.completed ? 'disabled' : ''}><span>${o.count == null ? 'Quantity unknown' : o.count + ' ×'} ${esc(o.items.map(i => i.name).join(' / '))}</span></label>`).join('')}</div></details>`;
  }
  function keepHTML(result, ctx) {
    const group = (bucket, title, description) => {
      const rows = result.keep.filter(r => r[bucket] || r.unknown.includes(bucket));
      return `<h3>${title}</h3><p class="map-note">${description}</p>${rows.length ? `<div class="keep-list">${rows.map(r => `<article class="career-row"><b>${r[bucket] || ''}${r.unknown.includes(bucket) ? (r[bucket] ? ' + quantity unknown' : 'Quantity unknown') : ''} × ${esc(r.items.slice(0, 3).map(i => i.name).join(' / '))}${r.items.length > 3 ? ` / ${r.items.length - 3} more choices` : ''}</b>${r.items.length > 1 ? '<p class="map-note">Any combination of these items; one shared quantity.</p>' : ''}${r.items.length > 3 ? `<details data-career-section="${esc(bucket + r.items.map(i => i.id).join('-'))}"><summary>All ${r.items.length} choices</summary><ul>${r.items.map(i => `<li>${esc(i.name)}</li>`).join('')}</ul></details>` : ''}<ul>${r.quests.filter(q => q.bucket === bucket).map(q => `<li>${esc(q.name)}${q.count == null ? ' · quantity unknown' : ' · ' + q.count}${q.note ? `<p class="map-note">${esc(q.note)}</p>` : ''}</li>`).join('')}</ul></article>`).join('')}</div>` : '<p class="map-note">No outstanding FIR items in this group.</p>'}`;
    };
    return `<h2>Keep · found in raid</h2><p class="map-note">All quests in this mode, across every map. Quantities are outstanding quest requirements, not an inventory count. Find and hand-over pairs count once. Optional objectives are excluded.</p>
      ${group('current', 'Current quests', 'Save these for your accepted quests.')}
      ${collectorHTML(result, ctx)}
      ${group('possible', 'Possible unlocks · estimates', 'These quests may be offered; opaque progression conditions can differ in game.')}
      <details data-career-section="future"><summary>Keep for later</summary>${group('later', 'Future quests', 'Locked quests may need these later. Faction variants and failed non-restartable quests are excluded.')}</details>`;
  }
  function kappaHTML(result, ctx, data) {
    const k = result.kappa;
    const list = (rows, blocked) => rows.length ? `<ul class="career-quests">${rows.map(t => `<li><b>${esc(t.name)}</b>${t.status === 'failed' ? `<strong class="career-warning"> Failed${data.progression[t.id]?.restartable ? ' · restartable' : ' · cannot restart'}</strong>` : ''}<p>${blocked ? esc((t.reasons || []).map(r => reason(r, data)).join(' · ') || 'No current acceptance recorded') : `${t.current ? 'Current' : 'Possible unlock · estimate'} · ${t.unlocks} Kappa ${t.unlocks === 1 ? 'quest' : 'quests'} downstream · level ${t.minLevel || 1}`}</p>${loyalty(t) ? `<p class="map-note">${esc(loyalty(t))}</p>` : ''}<p class="map-note">${mapLinks(t)}</p></li>`).join('')}</ul>` : '<p class="map-note">None in this group.</p>';
    return `<h2>Kappa · ${k.completed} / ${k.total} quests</h2><progress value="${k.completed}" max="${Math.max(1, k.total)}" aria-label="Kappa quest completion"></progress>
      <p class="map-note">Cached wiki requirements for ${ctx.mode === 'pve' ? 'PvE' : 'PvP'} · ${k.implied} completions implied by later quests. Trader loyalty is unverified and does not hide quests. Counts exclude the other faction.</p>
      <details data-career-section="traders"><summary>By trader</summary><ul>${k.traders.map(t => `<li>${esc(t.name)}: ${t.completed} / ${t.total}</li>`).join('')}</ul></details>
      ${collectorHTML(result, ctx)}
      <h3>What’s next</h3><p class="map-note">Current quests first, then possible unlocks. Each group is ordered by unfinished Kappa quests downstream, then level. Downstream counts describe the dependency graph; other gates may still apply.</p>${list(k.next.slice(0, 10), false)}
      ${k.next.length > 10 ? `<details data-career-section="more-next"><summary>${k.next.length - 10} more quests you can work toward</summary>${list(k.next.slice(10), false)}</details>` : ''}
      <details data-career-section="blocked"><summary>What’s blocking · ${k.blocked.length}</summary>${list(k.blocked, true)}</details>
      <details data-career-section="review"><summary>Wiki coverage to review · ${k.review.length}</summary><p class="map-note">Missing cached wiki coverage. These quests are excluded from the Kappa total until verified.</p><ul>${k.review.map(t => `<li>${esc(t.name)} · ${mapLinks(t)}</li>`).join('')}</ul></details>`;
  }
  function renderHost(host, html) {
    const open = new Set([...host.querySelectorAll('details[open][data-career-section]')].map(d => d.dataset.careerSection));
    const focused = host.contains(document.activeElement) ? document.activeElement.dataset.collector : null;
    host.innerHTML = html;
    host.querySelectorAll('[data-career-section]').forEach(d => { if (open.has(d.dataset.careerSection)) d.open = true; });
    if (focused) [...host.querySelectorAll('[data-collector]')].find(i => i.dataset.collector === focused)?.focus({preventScroll:true});
  }
  async function refresh() {
    const serial = ++generation, ctx = context(), mode = ctx.mode;
    try {
      cache[mode] ||= fetch(root + (mode === 'pve' ? 'pve/' : '') + 'career-data.json').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).catch(e => { delete cache[mode]; throw e; });
      const data = await cache[mode];
      if (serial !== generation) return;
      if (data.mode !== mode) throw new Error('Wrong game mode in quest data');
      const done = {};
      if (ctx.scope) for (const name of new Set(data.tasks.flatMap(t => t.maps.map(m => m.name)))) {
        try {
          const rows = JSON.parse(localStorage.getItem(`eft-checklist:${ctx.key}:${name}`)) || {};
          for (const [id, value] of Object.entries(rows)) {
            if (value === true) done[id] = true;
            else if (Number.isFinite(value) && done[id] !== true) done[id] = Math.max(Number(done[id]) || 0, value);
          }
        } catch (e) {}
      }
      const result = QuestCareer.evaluate(data, ctx.store, ctx.key, { ...ctx, done });
      latest = { data, result, ctx };
      button.textContent = `Kappa: ${result.kappa.completed} / ${result.kappa.total}`;
      const banner = ctx.scope ? `<p class="map-note">${esc(ctx.scope.label)} · ${mode === 'pve' ? 'PvE' : 'PvP'} · level ${ctx.level}</p>` : '<p class="notice">Choose a profile and wipe under Quests to track progress. No current quests or completions are assumed.</p>';
      document.querySelectorAll('[data-career-view]').forEach(host => { renderHost(host, banner + (host.dataset.careerView === 'keep' ? keepHTML(result, ctx) : kappaHTML(result, ctx, data))); });
      if (dialog.open) renderHost(body, banner + (view === 'keep' ? keepHTML(result, ctx) : kappaHTML(result, ctx, data)));
      document.querySelectorAll('[data-kappa-map]').forEach(host => { host.textContent = `${result.kappa.maps[host.dataset.kappaMap] || 0} Kappa quests here · current or possible unlocks`; });
    } catch (e) {
      button.textContent = 'Kappa: data unavailable';
      const message = '<p class="notice">Could not load quest data. Reload the page to try again.</p>';
      body.innerHTML = message;
      document.querySelectorAll('[data-career-view]').forEach(host => { host.innerHTML = message; });
    }
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(refresh, 0); }
  button.addEventListener('click', () => { view = 'kappa'; dialog.showModal(); dialog.scrollTop = 0; body.textContent = 'Loading quest data…'; refresh(); });
  document.addEventListener('click', e => {
    const link = e.target.closest('[data-career-quest]');
    if (link && window.SITE_HERE?.key === link.dataset.careerMap && window.SITE_HERE?.mode === latest?.ctx.mode && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault(); dialog.close(); window.SITE_HERE.open(link.dataset.careerQuest);
    }
    if (e.target.closest('[data-career-close]')) dialog.close();
    const tab = e.target.closest('[data-career-tab]');
    if (tab) { view = tab.dataset.careerTab; dialog.scrollTop = 0; refresh(); }
  });
  document.addEventListener('change', e => {
    const input = e.target.closest('[data-collector]');
    if (!input || !latest) return;
    const ctx = context();
    if (!ctx.scope || ctx.key !== latest.ctx.key || ctx.mode !== latest.ctx.mode) { refresh(); return; }
    ProgressStore.setCollector(ctx.store, ctx.key, input.dataset.collector, input.checked);
    try { localStorage.setItem(ProgressStore.STORAGE_KEY, JSON.stringify(ctx.store)); }
    catch (e) { input.checked = !input.checked; input.closest('[data-career-view],#careerBody').insertAdjacentHTML('afterbegin', '<p class="notice">Could not save hand-in. Browser storage is unavailable.</p>'); return; }
    window.dispatchEvent(new Event('eft-progress-change'));
  });
  window.addEventListener('eft-progress-change', schedule);
  window.addEventListener('storage', schedule);
  document.querySelector('.mode-toggle')?.addEventListener('click', schedule);
  refresh();
})();
