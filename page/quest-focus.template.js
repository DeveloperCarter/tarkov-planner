/* Focus mode: the quest at hand at full strength on the map, its path on to the next two, every other quest a
   faint dot, and an expanded card beside the map so nothing needs opening. */
let focusMode = QuestFocus.load(), focusPlan = null, focusOrder = [], focusPhoto = { id: null, i: 0 }, focusPicking = false, focusOthersOpen = false;
const focusActive = () => focusMode && pinned.length > 0 && !(raidOn && scavOn);
function computeFocusPlan() {
  if (!focusActive()) { focusPlan = null; focusOrder = []; return null; }
  const from = routeSession.start ? RaidSession.marker(DATA, routeSession.start) : null;
  const order = QuestFocus.sequence(DATA, pinned, { from, done: state });
  focusedQuest = QuestFocus.advance(focusOrder, order, focusedQuest);
  focusOrder = order;
  return focusPlan = QuestFocus.plan(DATA, pinned, { focused: focusedQuest, from, done: state });
}
const PIN_PATH = "M0 0C-3-6-11-10-11-19a11 11 0 1 1 22 0C11-10 3-6 0 0Z";
// Draws the plan and fills `at` (zone -> pinned indexes), as the normal pins do.
function focusOverlay(fp, at) {
  const z = DATA.zones, seen = new Set(), layers = { out: "", after: "", next: "", alt: "", now: "" }, paths = { after: "", next: "", now: "" };
  const place = p => `transform="translate(${p.x} ${p.y})"`;
  const pin = (zid, cls, q, glyph, label, style = "") => {
    if (seen.has(zid) || !z[zid]) return "";
    seen.add(zid);
    if (q) at.set(zid, [pinned.indexOf(q)]);
    return `<g class="pin spot ${cls}" data-zone="${esc(zid)}" ${place(z[zid])}${style ? ` style="${style}"` : ""} tabindex="${q ? 0 : -1}" role="button" aria-label="${esc(label)}"><g class="glyph">${glyph}</g></g>`;
  };
  const line = (l, kind) => {
    const pts = [l.from, ...l.stops].filter(Boolean);
    return pts.length > 1 ? `<polyline class="focus-path ${kind}" style="--qc:${colorOf(l.quest)}" points="${pts.map(p => `${p.x},${p.y}`).join(" ")}" vector-effect="non-scaling-stroke"/>` : "";
  };
  const { now, next, after } = fp;
  if (now) {
    const col = colorOf(now.quest);
    paths.now = line(now, "now");
    now.stops.forEach((st, i) => { layers.now += pin(st.zone, "stop", now.quest, `<path d="${PIN_PATH}" fill="${col}"/><text y="-15">${i + 1}</text>`, `Stop ${i + 1}: ${z[st.zone].name}, ${now.quest.name}`); });
    for (const zid of now.alts) layers.alt += pin(zid, "alt", now.quest, `<circle r="6"/>`, `Possible spot: ${z[zid].name}, ${now.quest.name}`, `--qc:${col}`);
  }
  for (const [l, kind, tag] of [[next, "next", "Next"], [after, "after", "After"]]) {
    if (!l) continue;
    paths[kind] = line(l, kind);
    l.stops.forEach((st, i) => { layers[kind] += pin(st.zone, `leg ${kind}`, l.quest, `<circle r="9"/><text y="3.5">${questNo(l.quest)}</text>${i ? "" : `<text class="tag" x="13" y="4">${tag}</text>`}`, `${tag}: ${l.quest.name}, ${z[st.zone].name}`, `--qc:${colorOf(l.quest)}`); });
  }
  for (const zid of fp.out) {
    const held = pinned.map((q, i) => RaidFocus.facts(q).zones.includes(zid) ? i : -1).filter(i => i >= 0);
    if (held.length) at.set(zid, held);
    layers.out += pin(zid, "out", null, `<circle r="3.5"/>`, z[zid].name);
  }
  const doors = now ? MapFloors.pointsOn(now.doors, currentFloor, ART_RECT?.floors).map(d => `<g class="pin door" data-door="${esc(d.id)}" ${place(d)} role="img" aria-label="Door for ${esc(d.key)}"><title>${esc(d.key)}</title><g class="glyph"><circle class="bg" r="9"/><circle class="bow" cx="-3" r="2.6"/><path d="M-.4 0h6.4M4 0v2.6"/><text x="13" y="4">${esc(QuestEffort.shortName(d.key).replace(/ key$/i, ""))}</text></g></g>`).join("") : "";
  const start = fp.from ? `<g class="objective-route" data-route-start ${place(fp.from)}><g class="glyph"><circle r="8" fill="var(--steel)"/><text x="12" y="4" fill="var(--ink)">Start</text></g></g>` : "";
  return layers.out + paths.after + paths.next + start + layers.after + layers.next + paths.now + layers.alt + doors + layers.now;
}
function focusFitKey(fp) { return `focus:${fp.now?.id}:${fp.now?.stops.map(s => s.zone).join()}:${fp.next?.stops[0]?.zone}:${JSON.stringify(routeSession.start)}`; }
function focusPoints() {
  const { now, next, from } = focusPlan;
  return [from, ...now.stops, ...now.alts.map(z => DATA.zones[z]), next?.stops[0], ...now.doors].filter(Boolean);
}
// One quest's objectives as ticks and counters, shared by raid-mode cards and the focus card.
function objectiveRows(q, where, nextId) {
  return `<ul class="rp-obj">${q.objectives.map(o => o.count
    ? `<li class="${objDone(o) ? "done" : ""} ${o.optional ? "opt" : ""} ${o.id === nextId ? "next-up" : ""}"><div class="rp-c"><span class="rp-t">${esc(o.text)}${where(o)}</span><span class="counter"><button type="button" data-dec="${o.id}" aria-label="Minus one">−</button><output>${state[o.id] || 0} / ${o.count}</output><button type="button" data-inc="${o.id}" aria-label="Plus one">+</button></span></div></li>`
    : `<li class="${objDone(o) ? "done" : ""} ${o.optional ? "opt" : ""} ${o.id === nextId ? "next-up" : ""}"><div class="rp-c"><input type="checkbox" data-obj="${o.id}" aria-label="${esc(o.text)}" ${objDone(o) ? "checked" : ""}><span>${esc(o.text)}${o.optional ? " (optional)" : ""}${where(o)}</span></div></li>`).join("")}</ul>`;
}
function doorButton(g, doors) {
  const d = g.kind === "key" && doors.find(d => d.keyId === g.id || d.need === g.name);
  return d ? `<button type="button" class="btn fc-door" data-door="${esc(d.id)}">Show door${d.metres != null ? ` · ${d.metres} m away` : ""}</button>` : "";
}
function focusCardHTML() {
  const fp = focusPlan;
  if (!fp?.now) return `<section class="fc"><span class="label">Focus</span><h3>Nothing left to route</h3><p class="map-note">Every selected quest's objectives are ticked. Hand them in once you're out, or choose more quests.</p></section>`;
  const { now, next, after, order, index } = fp, q = now.quest, photos = q.photos || [], zone = z => DATA.zones[z]?.name;
  if (focusPhoto.id !== now.id || focusPhoto.i >= photos.length) focusPhoto = { id: now.id, i: 0 };
  const stopOf = new Map(now.stops.flatMap((st, i) => st.objectives.map(o => [o, i + 1])));
  const where = o => {
    const names = (o.zone || []).map(zone).filter(Boolean);
    if (!names.length || objDone(o)) return "";
    const listed = names.length > 3 ? `${names.slice(0, 3).join(" or ")} or ${names.length - 3} more, ringed on the map` : names.join(" or ");
    return `<small class="rp-where">${stopOf.has(o.id) ? `<b>Stop ${stopOf.get(o.id)}</b> · ` : ""}${esc(listed)}</small>`;
  };
  const first = now.stops[0], h = first && now.from ? heading(now.from, first) : null;
  const go = first ? `<button type="button" class="fc-go" data-route-zone="${esc(first.zone)}"><span class="label">${now.stops.length > 1 ? `Stop 1 of ${now.stops.length}` : "Go to"}</span><b>${esc(zone(first.zone))}</b>${h ? `<small>${Math.round(h.metres)} m ${h.dir} of ${routeSession.source === "objective" ? "your last stop" : "your spawn"}</small>` : ""}</button>`
    : `<p class="fc-go"><span class="label">No fixed spot</span><b>${esc(QuestEffort.todo(q, objDone))}</b></p>`;
  const shot = photos[focusPhoto.i];
  const gallery = !photos.length ? `<p class="map-note">The wiki has no spot photos for this quest.</p>` : `<figure class="fc-photo"><button type="button" data-fc-zoom aria-label="Enlarge photo"><img src="${esc(shot.src)}" alt="${esc(shot.caption || q.name)}"></button><figcaption>${esc(shot.caption || "Spot photo")}${photos.length > 1 ? ` · ${focusPhoto.i + 1} of ${photos.length}` : ""}</figcaption></figure>` +
    (photos.length > 1 ? `<div class="fc-thumbs">${photos.map((p, i) => `<button type="button" data-fc-photo="${i}" aria-pressed="${i === focusPhoto.i}" aria-label="Photo ${i + 1}"><img src="${esc(p.src)}" alt="" loading="lazy"></button>`).join("")}</div>` : "");
  const legRow = (label, l) => {
    const stop = l.stops[0], away = stop && l.from ? heading(l.from, stop) : null;
    return `<button type="button" class="fc-leg" data-focus-quest="${esc(l.id)}">${label ? `<span class="label">${label}</span>` : ""}<i class="qnum" style="background:${colorOf(l.quest)}">${questNo(l.quest)}</i><span class="fc-leg-text"><b>${esc(l.quest.name)}</b><small>${stop ? `${esc(zone(stop.zone))}${away ? ` · ${Math.round(away.metres)} m ${away.dir}` : ""}` : l.todo || "No fixed spot"}</small></span></button>`;
  };
  const shown = new Set([now, next, after].filter(Boolean).map(l => l.id));
  const rest = order.filter(id => !shown.has(id)).map(id => pinned.find(x => bsgId(x) === id));
  return `<article class="fc" style="--qc:${colorOf(q)}" aria-label="${esc(q.name)}">
    <header class="fc-head"><button type="button" class="fc-step" data-quest-step="-1" aria-label="Previous quest" ${order.length < 2 ? "disabled" : ""}>‹</button>
      <div><span class="label">Now · ${index + 1} of ${order.length} · ${esc(q.trader)}</span><h3><i class="qnum" style="background:${colorOf(q)}">${questNo(q)}</i><span>${esc(q.name)}${q.kappa ? `<span class="kmark" title="Needed for Kappa">K</span>` : ""}${easyMark(q)}</span></h3></div>
      <button type="button" class="fc-step" data-quest-step="1" aria-label="Next quest" ${order.length < 2 ? "disabled" : ""}>›</button></header>
    ${go}${gallery}
    <section class="fc-sec"><span class="label">Objectives</span>${objectiveRows(q, where, QuestFocus.nextObjective(now, state)?.id)}</section>
    ${q.needs.length ? `<section class="fc-sec"><span class="label">Keys and items</span>${detailGear(q, now.doors)}</section>` : ""}
    ${q.tips.length ? `<section class="fc-sec"><span class="label">Tips</span><ul class="tips">${q.tips.map(t => `<li>${esc(t)}</li>`).join("")}</ul></section>` : ""}
    ${now.also.length ? `<p class="fc-also"><span class="label">Also at these stops</span>${now.also.map(a => `<button type="button" class="qlink" data-focus-quest="${esc(a.id)}">${esc(a.quest.name)}</button>`).join(", ")}</p>` : ""}
    ${next || after ? `<section class="fc-sec fc-legs">${next ? legRow("Next", next) : ""}${after ? legRow("After", after) : ""}</section>` : ""}
    ${rest.length ? `<details class="fc-others" data-fc-others ${focusOthersOpen ? "open" : ""}><summary>Other quests · ${rest.length}</summary>${rest.map(x => legRow("", { id: bsgId(x), quest: x, stops: [], from: null, todo: QuestEffort.todo(x, objDone) })).join("")}</details>` : ""}
    <p class="map-note fc-keys">← → photos · Page Down ticks the outlined objective · Page Up undoes</p>
    <footer class="fc-foot"><button type="button" class="qlink" data-detail="${esc(now.id)}">Full details</button><a href="${esc(q.wiki)}" target="_blank" rel="noopener">Wiki ↗</a></footer>
  </article>`;
}
function renderFocusCard() {
  const on = focusActive(), docked = on && !raidOn, card = document.getElementById('focusCard'), toggle = document.getElementById('focusToggle'), picker = document.getElementById('focusPicker');
  document.body.classList.toggle('quest-focus', on);
  document.body.classList.toggle('picker-open', docked && focusPicking);
  toggle.setAttribute('aria-checked', String(focusMode));
  toggle.disabled = !pinned.length;
  card.hidden = picker.hidden = !docked;
  if (docked) { const top = card.scrollTop; card.innerHTML = focusCardHTML(); card.scrollTop = top; } else card.innerHTML = '';
  picker.setAttribute('aria-expanded', String(focusPicking));
  picker.textContent = focusPicking ? 'Hide quest list' : 'Change quests';
}
function showFocused() { renderMap(); renderRaidPanel(); }
// Another quest starts at the top of its card, not wherever the last one was scrolled to.
function focusScrollTop() {
  rpBody.scrollTop = 0;
  const card = document.getElementById('focusCard');
  card.scrollTop = 0;
  if (!card.hidden && getComputedStyle(card).position !== 'fixed' && card.getBoundingClientRect().top < 70) window.scrollBy(0, card.getBoundingClientRect().top - 70);
}
function showFocusedTop() { showFocused(); focusScrollTop(); }
function showFocusPhoto(i) {
  const now = focusPlan?.now, photos = now?.quest.photos || [], p = photos[i], card = document.querySelector('.fc-photo')?.closest('.fc');
  if (!p || !card) return;
  focusPhoto = { id: now.id, i };
  const img = card.querySelector('.fc-photo img');
  img.src = p.src; img.alt = p.caption || now.quest.name;
  card.querySelector('.fc-photo figcaption').textContent = `${p.caption || 'Spot photo'}${photos.length > 1 ? ` · ${i + 1} of ${photos.length}` : ''}`;
  card.querySelectorAll('[data-fc-photo]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.fcPhoto === String(i))));
}
// Page Down and Page Up, on the page or through the extension. Undo also returns to the quest it came from.
const focusUndo = [];
function tickNextObjective() {
  const was = focusPlan?.now?.id, o = QuestFocus.nextObjective(focusPlan?.now, state);
  if (!o) return;
  focusUndo.push({ scope: scopeKey, quest: was, id: o.id, before: state[o.id] });
  if (focusUndo.length > 50) focusUndo.shift();
  state[o.id] = QuestFocus.objectiveValue(o, state);
  save(); renderQuests();
  if (focusPlan?.now?.id !== was) focusScrollTop();
}
function undoObjective() {
  const last = focusUndo.pop();
  if (!last) return;
  if (last.scope !== scopeKey) { focusUndo.length = 0; return; } // another profile's checklist is loaded now
  if (last.before === undefined) delete state[last.id]; else state[last.id] = last.before;
  const moved = focusPlan?.now?.id !== last.quest;
  focusedQuest = last.quest;
  save(); renderQuests();
  if (moved) focusScrollTop();
}
function runFocusAction(action) {
  if (!focusActive() || document.querySelector('dialog[open]')) return;
  if (action === 'objective-next') return tickNextObjective();
  if (action === 'objective-undo') return undoObjective();
  const step = action === 'photo-next' ? 1 : action === 'photo-previous' ? -1 : 0, count = focusPlan?.now?.quest.photos?.length || 0;
  if (!step) return;
  if (!lightbox.hidden) return stepLightbox(step);
  if (count > 1) showFocusPhoto((focusPhoto.i + step + count) % count);
}
document.addEventListener('keydown', e => {
  const action = QuestFocus.keyAction(e);
  // Ticks stay usable straight after clicking a checkbox; anything you type or choose in keeps its keys.
  if (!action || !focusActive() || e.target.closest?.('input:not([type="checkbox"]),textarea,select,[contenteditable]:not([contenteditable="false"])') || document.querySelector('dialog[open]')) return;
  e.preventDefault(); runFocusAction(action);
});
// The extension sends one of these names, so it can do this while Tarkov has focus.
document.addEventListener('eft-quest-action', e => { if (QuestFocus.ACTIONS.includes(e.detail)) runFocusAction(e.detail); });
function setFocusMode(on) {
  focusMode = on; QuestFocus.save(on);
  document.getElementById('focusSetting').checked = on;
  closePop(); showFocused();
}
document.getElementById('focusToggle').addEventListener('click', () => setFocusMode(!focusMode));
document.getElementById('focusPicker').addEventListener('click', () => { focusPicking = !focusPicking; renderFocusCard(); });
window.addEventListener('eft-quest-focus-change', () => { focusMode = QuestFocus.load(); closePop(); showFocused(); });
document.getElementById('focusCard').addEventListener('change', questControlsChange);
document.getElementById('focusCard').addEventListener('click', questControlsClick);
document.addEventListener('toggle', e => { if (e.target.dataset?.fcOthers !== undefined) focusOthersOpen = e.target.open; }, true);
document.addEventListener('click', e => {
  const pick = e.target.closest('[data-focus-quest]');
  if (pick && focusActive()) { focusedQuest = pick.dataset.focusQuest; closePop(); return showFocusedTop(); }
  const door = e.target.closest('[data-door]'), now = focusPlan?.now;
  if (door && now) {
    const d = now.doors.find(d => d.id === door.dataset.door);
    if (d) { showFloorOf(d); fit(true, null, [d]); requestAnimationFrame(() => svg.querySelector(`.pin.door[data-door="${CSS.escape(d.id)}"]`)?.classList.add("flash")); }
    return;
  }
  const thumb = e.target.closest('[data-fc-photo]');
  if (thumb) return showFocusPhoto(Number(thumb.dataset.fcPhoto));
  if (e.target.closest('[data-fc-zoom]') && now) openLightbox(focusPhoto.i, now.quest.photos);
});
