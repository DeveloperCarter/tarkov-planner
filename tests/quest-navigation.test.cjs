const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const Nav = require('../page/quest-navigation.js');

test('quest navigation follows supplied route order, wraps and reconciles removed quests without mutation', () => {
  const ids = Object.freeze(['second', 'first', 'unlocated']);
  assert.equal(Nav.current(ids, 'first'), 'first');
  assert.equal(Nav.current(ids, 'removed'), 'second');
  assert.equal(Nav.step(ids, 'second', 1), 'first');
  assert.equal(Nav.step(ids, 'second', -1), 'unlocated');
  assert.equal(Nav.step(ids, 'unlocated', 1), 'second');
  assert.equal(Nav.step(ids, null, -1), 'unlocated');
  assert.equal(Nav.step([], 'old', 1), null);
  assert.equal(Nav.step(['only'], 'only', 1), 'only');
  assert.equal(Nav.step(ids, 'first', 10), 'first');
  const sandbox = {}; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../page/quest-navigation.js'), 'utf8'), sandbox);
  assert.equal(sandbox.QuestNavigation.step(['a', 'b'], 'a', 1), 'b');
});

test('local navigation keys require Ctrl+Shift, ignore repeats and leave unrelated keys alone', () => {
  const event = { key: 'ArrowRight', ctrlKey: true, shiftKey: true };
  assert.equal(Nav.keyboard(event), 1);
  assert.equal(Nav.keyboard({ ...event, key: 'ArrowLeft' }), -1);
  for (const override of [{ ctrlKey: false }, { shiftKey: false }, { altKey: true }, { metaKey: true }, { repeat: true }, { key: 'Enter' }])
    assert.equal(Nav.keyboard({ ...event, ...override }), 0);
});

test('actual page controller highlights and frames only; dialogs, inputs, scav and exit pause commands', () => {
  const listeners = {}, fits = [], scrolls = [], attrs = {}, nodes = {};
  function node(id) {
    const classes = new Set();
    return { dataset: { questCard: id, zone: id }, classList: { toggle(c, on) { on ? classes.add(c) : classes.delete(c); }, contains: c => classes.has(c) },
      setAttribute(k, v) { this[k] = v; }, removeAttribute(k) { delete this[k]; },
      scrollIntoView() { scrolls.push(id); }, textContent: '', querySelectorAll: () => [] };
  }
  const cards = ['b', 'a', 'no-map'].map(node), pins = ['za', 'zb'].map(node);
  for (const id of ['questFocusNav', 'questFocusLabel']) nodes[id] = node(id);
  nodes.questFocusNav.addEventListener = (type, fn) => { listeners.nav = fn; };
  let dialog = false, observer;
  const sandbox = { QuestNavigation: Nav, raidOn: true, scavOn: false,
    pinned: Object.freeze([{ id: 'b', name: 'B', zones: ['zb'] }, { id: 'a', name: 'A', zones: ['za'] }, { id: 'no-map', name: 'No map', zones: [] }]),
    bsgId: q => q.id, RaidFocus: { facts: q => ({ zones: q.zones }) },
    document: { documentElement: { dataset: attrs }, body: {}, getElementById: id => nodes[id],
      querySelector: () => dialog ? {} : null, addEventListener: (type, fn) => { listeners[type] = fn; } },
    rpBody: { querySelectorAll: () => cards }, svg: { querySelectorAll: () => pins },
    closePop() {}, fit: (animate, zones) => fits.push(zones),
    MutationObserver: class { constructor(fn) { observer = fn; } observe() {} } };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../page/quest-navigation.template.js'), 'utf8'), sandbox);
  vm.runInContext('paintQuestNavigation()', sandbox);
  assert.match(nodes.questFocusLabel.textContent, /1 of 3 · B/);
  listeners['eft-quest-focus']({ detail: '1' });
  assert.equal(cards[1]['aria-current'], 'true'); assert.deepEqual(fits, [['za']]);
  assert.equal(pins[0].classList.contains('quest-focused'), true);
  listeners['eft-quest-focus']({ detail: '1' });
  assert.match(nodes.questFocusLabel.textContent, /No fixed map locations/); assert.equal(fits.length, 1);
  dialog = true; observer(); assert.equal(attrs.questNavigationReady, '0');
  listeners['eft-quest-focus']({ detail: '1' }); assert.equal(scrolls.length, 2);
  dialog = false;
  const keyboard = { key: 'ArrowRight', ctrlKey: true, shiftKey: true, preventDefault() {}, target: { closest: () => ({}) } };
  listeners.keydown(keyboard); assert.equal(scrolls.length, 2, 'typing leaves focus alone');
  sandbox.scavOn = true; listeners['eft-quest-focus']({ detail: '-1' }); assert.equal(scrolls.length, 2);
  sandbox.scavOn = false; sandbox.raidOn = false; listeners['eft-quest-focus']({ detail: '-1' }); assert.equal(scrolls.length, 2);
  sandbox.raidOn = true; listeners['eft-quest-focus']({ detail: '99' }); assert.equal(scrolls.length, 2);
  sandbox.pinned = [sandbox.pinned[0]]; vm.runInContext('paintQuestNavigation()', sandbox);
  assert.match(nodes.questFocusLabel.textContent, /1 of 1 · B/);
  assert.equal(Object.keys(sandbox).some(k => ['progressStore', 'state', 'localStorage'].includes(k)), false);
});
