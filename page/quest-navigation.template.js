/* Visual focus within the selected, route-ordered quests. No progress writes. */
let focusedQuest = null;
function questNavigationReady() {
  return (raidOn && !scavOn || focusActive()) && pinned.length > 0 && !document.querySelector('dialog[open]');
}
function paintQuestNavigation() {
  const ids = pinned.map(bsgId), inFocus = focusActive();
  if (!inFocus) focusedQuest = raidOn ? QuestNavigation.current(ids, focusedQuest) : null;
  const q = inFocus ? null : pinned.find(q => bsgId(q) === focusedQuest);
  const zones = new Set(q ? RaidFocus.facts(q).zones : []);
  const nav = document.getElementById('questFocusNav');
  nav.hidden = !raidOn || scavOn || inFocus;
  document.getElementById('questFocusLabel').textContent = q
    ? `Quest ${ids.indexOf(focusedQuest) + 1} of ${ids.length} · ${q.name}${q.kappa ? ' · Kappa' : ''}${zones.size ? '' : ' · No fixed map locations'}`
    : 'Select quests to browse this raid.';
  nav.querySelectorAll('button').forEach(b => { b.disabled = !ids.length; });
  rpBody.querySelectorAll('.rp-q').forEach(card => {
    const on = raidOn && !scavOn && card.dataset.questCard === focusedQuest;
    card.classList.toggle('quest-focused', on);
    if (on) card.setAttribute('aria-current', 'true'); else card.removeAttribute('aria-current');
  });
  const focusIndex = q ? pinned.indexOf(q) : -1;
  svg.querySelectorAll('.pin.spot').forEach(pin => {
    pin.classList.toggle('quest-focused', raidOn && !scavOn && zones.has(pin.dataset.zone));
    // A shared pin puts the focused quest's number on top.
    if (pin.dataset.quests?.includes(',')) pin.querySelector('.glyph').innerHTML = pinGlyph(pin.dataset.quests.split(',').map(Number), focusIndex);
  });
  document.documentElement.dataset.questNavigationReady = questNavigationReady() ? '1' : '0';
}
function stepQuestFocus(direction) {
  if (!questNavigationReady() || ![-1, 1].includes(direction)) return;
  if (focusActive()) {
    if (focusOrder.length < 2) return;
    focusedQuest = QuestNavigation.step(focusOrder, focusedQuest, direction);
    closePop(); showFocusedTop();
    return;
  }
  focusedQuest = QuestNavigation.step(pinned.map(bsgId), focusedQuest, direction);
  closePop();
  paintQuestNavigation();
  const q = pinned.find(q => bsgId(q) === focusedQuest), zones = RaidFocus.facts(q).zones;
  if (zones.length) fit(true, zones);
  const card = [...rpBody.querySelectorAll('.rp-q')].find(card => card.dataset.questCard === focusedQuest);
  card?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
}
document.addEventListener('click', e => {
  const button = e.target.closest('[data-quest-step]');
  if (button) stepQuestFocus(Number(button.dataset.questStep));
});
document.addEventListener('keydown', e => {
  const direction = QuestNavigation.keyboard(e);
  if (!direction || e.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])') || !questNavigationReady()) return;
  e.preventDefault(); stepQuestFocus(direction);
});
// The extension emits only a direction; the same guarded action serves buttons and local keys.
document.addEventListener('eft-quest-focus', e => stepQuestFocus(Number(e.detail)));
new MutationObserver(() => {
  document.documentElement.dataset.questNavigationReady = questNavigationReady() ? '1' : '0';
}).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
document.documentElement.dataset.questNavigation = '1';
