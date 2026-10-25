const test = require('node:test'), assert = require('node:assert/strict');
const F = require('../page/quest-filter.js');

const quests = [
  { id: 'pk', trader: 'Prapor', kappa: true }, { id: 'p', trader: 'Prapor', kappa: false },
  { id: 'jk', trader: 'Jaeger', kappa: true }, { id: 's', trader: 'Skier' },
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
  assert.deepEqual(f, { traders: [], kappa: true });
  assert.equal(F.active(f), true); assert.equal(F.active(F.empty()), false);
});

test('counts follow the other half of the filter', () => {
  assert.deepEqual(F.counts(quests, F.empty()), { traders: [{ name: 'Prapor', count: 2 }, { name: 'Jaeger', count: 1 }, { name: 'Skier', count: 1 }], kappa: 2 });
  assert.deepEqual(F.counts(quests, { traders: ['Prapor'], kappa: true }),
    { traders: [{ name: 'Prapor', count: 1 }, { name: 'Jaeger', count: 1 }, { name: 'Skier', count: 0 }], kappa: 1 }, 'order stays by list size');
});

test('stored values are cleaned up', () => {
  assert.deepEqual(F.normalize(null), F.empty());
  assert.deepEqual(F.normalize({ traders: ['Skier', 'Prapor', 'Prapor', 3, ''], kappa: 'yes' }), { traders: ['Prapor', 'Skier'], kappa: false });
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
