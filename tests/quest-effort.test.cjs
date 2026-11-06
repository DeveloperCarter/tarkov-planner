const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../page/quest-effort.js');
const base = { spots: 1, unlocated: 0, extracts: 0, maps: 1, kills: 0, hardKills: false, fir: false, streak: false, grind: false, keys: [] };

test('a small quest with no key is an easy win and says why', () => {
  const a = E.assess(base, { level: 25 });
  assert.equal(a.easy, true); assert.deepEqual(a.reasons, ['1 spot', 'no key', 'no kills']);
  assert.deepEqual(E.assess({ ...base, spots: 0, extracts: 1 }).reasons[0], 'just extract');
});

test('keys count as easy only when you can buy them at your level', () => {
  const keycard = { ...base, keys: [{ name: 'Keycard', fleaLevel: 30, trader: false }] };
  assert.equal(E.assess(keycard, { level: 25 }).easy, false);
  assert.deepEqual(E.assess(keycard, { level: 25 }).reasons, ['Keycard needs flea level 30']);
  assert.equal(E.assess(keycard, { level: 30 }).easy, true);
  assert.equal(E.assess({ ...base, keys: [{ name: 'Shop key', fleaLevel: 40, trader: true }] }, { level: 1 }).easy, true, 'trader cash offers count');
  assert.match(E.assess({ ...base, keys: [{ name: 'Quest key', fleaLevel: null, trader: false }] }, { level: 60 }).reasons[0], /isn't sold on the flea/);
});

test('kills, hand-ins, streaks, maps and spots block easy wins; easier quests score lower', () => {
  for (const [extra, why] of [[{ hardKills: true }, /PMC/], [{ kills: 6 }, /6 kills/], [{ fir: true }, /found-in-raid/],
    [{ streak: true }, /extracts/], [{ maps: 2 }, /2 maps/], [{ spots: 3 }, /3 spots/], [{ unlocated: 1 }, /doesn't show/], [{ grind: true }, /grind/]]) {
    const a = E.assess({ ...base, ...extra }, { level: 25 });
    assert.equal(a.easy, false); assert.match(a.reasons.join(), why);
  }
  assert.equal(E.assess({ ...base, kills: 5 }).easy, true);
  assert.ok(E.assess(base).score < E.assess({ ...base, spots: 2, kills: 4 }).score);
  assert.equal(E.assess(null).easy, false);
});

test('gear says how you would get each key or item, and what blocks a quest', () => {
  const g = (extra) => ({ id: 'x', name: 'X', fleaLevel: null, trader: false, barter: false, ...extra });
  assert.deepEqual(E.gear(g({ fleaLevel: 25 }), { level: 28 }), { ok: true, how: 'flea', label: 'flea' });
  assert.equal(E.gear(g({ fleaLevel: 30, trader: true }), { level: 28 }).how, 'trader');
  assert.deepEqual(E.gear(g({ fleaLevel: 30, barter: true }), { level: 28 }), { ok: false, how: 'barter', label: 'barter only, flea at level 30' });
  assert.deepEqual(E.gear(g({}), { level: 60 }), { ok: false, how: 'find', label: 'find in raid' });
  assert.equal(E.gear(g({}), { level: 1, have: { x: true } }).how, 'have', 'a ticked item beats every source');
  const facts = { keys: [{ id: 'k', name: 'Office key', fleaLevel: null, trader: false, barter: false }],
    items: [{ id: 'm', name: 'MS2000 Marker', qty: 3, fleaLevel: 20, trader: false, barter: false }] };
  const r = E.readiness(facts, { level: 28 });
  assert.equal(r.ready, false);
  assert.deepEqual(r.blocked.map(x => x.name), ['Office key']);
  assert.deepEqual(r.gear.map(x => [x.kind, x.how]), [['key', 'find'], ['item', 'flea']]);
  assert.equal(E.readiness(facts, { level: 28, have: { k: true } }).ready, true);
  assert.equal(E.readiness(null).ready, false, 'unknown facts are never ready');
  assert.equal(E.readiness({ keys: [] }).ready, true, 'older facts without items still work');
  assert.equal(E.assess({ ...base, keys: facts.keys }, { level: 28, have: { k: true } }).easy, true, 'a key you have no longer blocks an easy win');
});

test('acquisition rows read as gear', () => {
  const a = { itemId: 'i', item: 'Hose', kind: 'item', fleaLevel: null, sources: ['Mechanic LL1: 14,594 RUB', 'Prapor LL2 barter: 1x Bolts'] };
  assert.deepEqual(E.fromAcquisition(a), { id: 'i', name: 'Hose', kind: 'item', fleaLevel: null, trader: true, barter: true });
  assert.equal(E.fromAcquisition({ ...a, sources: ['No trader, barter or craft source. Find it in raid.'] }).barter, false);
});

test('todo sums up what is left in a few words', () => {
  const q = { objectives: [{ id: 'a', type: 'mark', zone: ['z1'] }, { id: 'b', type: 'visit', zone: ['z2'] }, { id: 'c', type: 'visit', zone: ['z2'] },
    { id: 'd', type: 'shoot', count: 10, targets: ['Sniper', 'Scavs'] }, { id: 'e', type: 'giveItem', foundInRaid: true }, { id: 'f', type: 'extract', count: 1 },
    { id: 'g', type: 'shoot', count: 2, targets: ['Any PMC operatives'], optional: true }] };
  assert.equal(E.todo(q), '2 spots · kill 10 Scavs · hand in found-in-raid items · extract');
  assert.equal(E.todo(q, o => o.id !== 'f'), 'extract');
  assert.equal(E.todo(q, () => true), 'nothing left here');
  assert.equal(E.todo({ objectives: [{ id: 'x', type: 'shoot', count: 5, targets: ['Any PMC operatives'] }, { id: 'y', type: 'extract', count: 3 }] }), 'kill 5 PMCs · extract 3 times');
});

test('items you cannot get block an easy win, and any-of names shorten', () => {
  const hose = { id: 'h', name: 'Corrugated hose', fleaLevel: null, trader: false, barter: false };
  assert.deepEqual(E.assess({ ...base, items: [hose] }, { level: 28 }).reasons, ['Corrugated hose: find in raid']);
  assert.equal(E.assess({ ...base, items: [hose] }, { level: 28, have: { h: true } }).easy, true);
  assert.equal(E.shortName('Any of: M993 pack (20 pcs), M61 pack (20 pcs) (+5 more)'), 'M993 pack (20 pcs) or similar');
  assert.equal(E.shortName('Any of: A (+2 more)'), 'A or similar');
  assert.equal(E.shortName('MS2000 Marker'), 'MS2000 Marker');
});
