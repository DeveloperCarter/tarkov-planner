const test = require('node:test'), assert = require('node:assert/strict');
const F = require('../page/quest-filter.js');

const quests = [
  { id: 'pk', trader: 'Prapor', kappa: true, easy: true }, { id: 'p', trader: 'Prapor', kappa: false },
  { id: 'jk', trader: 'Jaeger', kappa: true }, { id: 's', trader: 'Skier', easy: true },
];
const pick = f => quests.filter(q => F.matches(q, f)).map(q => q.id);

test('traders widen and Kappa narrows', () => {
  let f = F.empty();
  assert.deepEqual(pick(f), ['pk', 'p', 'jk', 's']);
  f = F.toggleTrader(f, 'Prapor');
  assert.deepEqual(pick(f), ['pk', 'p']);
  f = F.toggleKappa(f);
  assert.deepEqual(pick(f), ['pk'], 'Prapor + Kappa = Prapor\'s Kappa quests');
  f = F.toggleTrader(f, 'Jaeger');
  assert.deepEqual(pick(f), ['pk', 'jk']);
  assert.equal(F.summary(f), 'Kappa · Jaeger or Prapor');
  f = F.toggleTrader(F.toggleTrader(f, 'Prapor'), 'Jaeger');
  assert.deepEqual(f, { traders: [], kinds: [], ready: false, easy: false, kappa: true, noKeys: false });
  assert.equal(F.active(f), true); assert.equal(F.active(F.empty()), false);
});

test('counts follow the other half of the filter', () => {
  const noKinds = { combat: 0, pickup: 0, place: 0 };
  assert.deepEqual(F.counts(quests, F.empty()), { traders: [{ name: 'Prapor', count: 2 }, { name: 'Jaeger', count: 1 }, { name: 'Skier', count: 1 }], ready: 0, easy: 2, kappa: 2, noKeys: 0, kinds: noKinds });
  assert.deepEqual(F.counts(quests, { traders: ['Prapor'], kappa: true, easy: false }),
    { traders: [{ name: 'Prapor', count: 1 }, { name: 'Jaeger', count: 1 }, { name: 'Skier', count: 0 }], ready: 0, easy: 1, kappa: 1, noKeys: 0, kinds: noKinds }, 'order stays by list size');
});

test('Easy narrows like Kappa', () => {
  let f = F.toggleEasy(F.empty());
  assert.deepEqual(pick(f), ['pk', 's']);
  f = F.toggleKappa(f);
  assert.deepEqual(pick(f), ['pk']);
  assert.equal(F.summary(F.toggleTrader(f, 'Prapor')), 'Easy · Kappa · Prapor');
});

test('No keys and objective kinds read effort facts, and unknown facts never match', () => {
  const list = [{ id: 'free', effort: { keys: [], kinds: ['combat'] } }, { id: 'key', effort: { keys: [{ name: 'K' }], kinds: ['place'] } },
    { id: 'both', effort: { keys: [], kinds: ['combat', 'pickup'] } }, { id: 'unknown' }];
  const ids = f => list.filter(q => F.matches(q, F.normalize(f))).map(q => q.id);
  assert.deepEqual(ids({ noKeys: true }), ['free', 'both']);
  assert.deepEqual(ids({ kinds: ['place', 'pickup'] }), ['key', 'both'], 'any chosen kind');
  assert.deepEqual(ids({ noKeys: true, kinds: ['pickup'] }), ['both'], 'kinds and No keys narrow each other');
  assert.equal(F.active(F.toggleNoKeys(F.empty())), true);
  assert.equal(F.active(F.toggleKind(F.empty(), 'combat')), true);
  assert.equal(F.summary(F.toggleKind(F.toggleNoKeys(F.empty()), 'place')), 'No keys · Mark & place');
  const c = F.counts(list, F.toggleKind(F.empty(), 'combat'));
  assert.equal(c.noKeys, 2);
  assert.deepEqual(c.kinds, { combat: 2, pickup: 1, place: 1 }, 'a kind chip ignores the other kinds, since they widen');
});

test('stored values are cleaned up', () => {
  assert.deepEqual(F.normalize(null), F.empty());
  assert.deepEqual(F.normalize({ traders: ['Skier', 'Prapor', 'Prapor', 3, ''], kappa: 'yes', easy: true, noKeys: 1, kinds: ['place', 'combat', 'place', 'toString'] }),
    { traders: ['Prapor', 'Skier'], kinds: ['combat', 'place'], ready: false, easy: true, kappa: false, noKeys: false });
});

test('chips fold past the limit, keep chosen traders visible, and expand to show all', () => {
  const traders = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((name, i) => ({ name, count: 7 - i }));
  let items = F.chipItems(F.empty(), traders, { limit: 3 });
  assert.deepEqual(items.traders.map(t => t.name), ['A', 'B', 'C']);
  assert.equal(items.hidden, 4); assert.equal(items.foldable, true);
  items = F.chipItems({ traders: ['F'], kappa: false }, traders, { limit: 3 });
  assert.deepEqual(items.traders.map(t => [t.name, t.on]), [['A', false], ['B', false], ['C', false], ['F', true]]);
  assert.equal(items.hidden, 3);
  items = F.chipItems({ traders: ['Gone'], kappa: false }, traders, { limit: 3, expanded: true });
  assert.equal(items.traders.length, 8, 'a chosen trader with no quests here stays so it can be turned off');
  assert.deepEqual(items.traders.at(-1), { name: 'Gone', count: 0, on: true });
  assert.equal(F.chipItems(F.empty(), traders.slice(0, 3), { limit: 3 }).foldable, false);
});

test('Gear ready narrows on the flag each page sets, and the bar names every active filter', () => {
  const list = [{ id: 'r', trader: 'Prapor', ready: true }, { id: 'n', trader: 'Prapor', ready: false }, { id: 'u', trader: 'Skier' }];
  const f = F.toggle(F.empty(), 'ready');
  assert.deepEqual(list.filter(q => F.matches(q, f)).map(q => q.id), ['r']);
  assert.equal(F.counts(list, F.empty()).ready, 1);
  assert.equal(F.summary(F.toggleTrader(f, 'Skier')), 'Gear ready · Skier');
  assert.deepEqual(F.toggle(F.empty(), 'toString'), F.empty(), 'unknown flags change nothing');
  assert.equal(F.matches({ trader: 'X' }, { kappa: false }), true, 'a partial filter object still works');
});
