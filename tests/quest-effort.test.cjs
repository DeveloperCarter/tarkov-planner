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
