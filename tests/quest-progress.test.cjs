const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../page/quest-progress.js');
const task = (requirements = [], extra = {}) => ({ requirements, minLevel: 1, faction: 'Any', restartable: false, ...extra });
const req = (id, statuses = ['complete']) => ({ task: id, statuses });
const chain = { a: task(), b: task([req('a')]), c: task([req('b')]) };
test('completion chain unlocks one quest at a time', () => {
  assert.equal(P.evaluate(chain).quests.a.available, true);
  assert.equal(P.evaluate(chain).quests.b.locked, true);
  assert.equal(P.evaluate(chain, { a: 'completed' }).quests.b.available, true);
  assert.equal(P.evaluate(chain, { a: 'completed' }).quests.c.available, false);
});
test('active, complete and failed prerequisite status lists', () => {
  const data = { a: task(), b: task([req('a', ['active', 'complete'])]), c: task([req('a', ['failed'])]) };
  assert.equal(P.evaluate(data, { a: 'started' }).quests.b.available, true);
  assert.equal(P.evaluate(data, { a: 'completed' }).quests.b.available, true);
  assert.equal(P.evaluate(data, { a: 'failed' }).quests.b.available, false);
  assert.equal(P.evaluate(data, { a: 'failed' }).quests.c.available, true);
});
test('started or completed quests imply complete prerequisites recursively without mutating input', () => {
  for (const status of ['started', 'completed']) {
    const input = { c: { status, source: 'log' } };
    const result = P.evaluate(chain, input);
    assert.equal(result.quests.a.status, 'completed');
    assert.equal(result.quests.a.inferred, true);
    assert.equal(result.quests.b.status, 'completed');
    assert.deepEqual(Object.keys(input), ['c']);
  }
});
test('manual statuses, including not started, override inference and stop that chain', () => {
  for (const status of ['started', 'failed', 'not-started', 'completed']) {
    const result = P.evaluate(chain, { c: 'started', b: { status, source: 'manual' } });
    assert.equal(result.quests.b.status, status);
    assert.equal(result.quests.b.inferred, false);
    // A manual started/completed quest is itself evidence for its prerequisites.
    assert.equal(result.quests.a.completed, ['started', 'completed'].includes(status));
  }
});
test('inference does not guess active or failed alternatives; cycles terminate', () => {
  const data = { a: task(), b: task([req('a', ['active', 'complete'])]), c: task([req('b', ['complete', 'failed'])]) };
  assert.equal(P.evaluate(data, { c: 'started', b: 'started' }).quests.a.completed, false);
  const cyclic = { a: task([req('b')]), b: task([req('a')]) };
  assert.equal(P.evaluate(cyclic, { a: 'started' }).quests.b.completed, true);
});
test('failed quests stay hidden unless restartable', () => {
  const result = P.evaluate({ a: task(), b: task([], { restartable: true }) }, { a: 'failed', b: 'failed' });
  assert.equal(P.visible(result.quests.a), false);
  assert.equal(P.visible(result.quests.b), true);
  assert.equal(P.visible(result.quests.a, 'all'), true);
});
test('level and faction gate, while trader loyalty only annotates', () => {
  const data = { a: task([], { minLevel: 24, faction: 'USEC', traderRequirements: [{ trader: 'Therapist', value: 2 }] }) };
  assert.equal(P.evaluate(data, {}, { level: 23, faction: 'USEC' }).quests.a.available, false);
  assert.equal(P.evaluate(data, {}, { level: 24, faction: 'BEAR' }).quests.a.available, false);
  assert.equal(P.evaluate(data, {}, { level: 24, faction: 'USEC' }).quests.a.available, true);
});
test('view filters hide completed/locked by default and show started in Active only', () => {
  const result = P.evaluate(chain, { b: 'started' });
  assert.equal(P.visible(result.quests.a), false);
  assert.equal(P.visible(result.quests.b, 'active'), true);
  assert.equal(P.visible(result.quests.c, 'active'), false);
  assert.equal(P.visible(result.quests.a, 'all'), true);
});
test('wiki alternative branches unlock on either completion and are not inferred', () => {
  const data = { a: task(), b: task(), c: task([
    { ...req('a'), anyOf: 'previous' }, { ...req('b'), anyOf: 'previous' }
  ]) };
  assert.equal(P.evaluate(data).quests.c.available, false);
  assert.equal(P.evaluate(data, { a: 'completed' }).quests.c.available, true);
  assert.equal(P.evaluate(data, { b: 'completed' }).quests.c.available, true);
  const result = P.evaluate(data, { c: 'started' });
  assert.equal(result.quests.a.completed, false);
  assert.equal(result.quests.b.completed, false);
});
test('browser UMD export works without CommonJS', () => {
  const vm = require('node:vm');
  const fs = require('node:fs');
  const context = { self: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../page/quest-progress.js'), 'utf8'), context);
  assert.equal(typeof context.self.QuestProgress.evaluate, 'function');
  assert.equal(context.self.QuestProgress.evaluate(chain).quests.a.available, true);
});
test('unresolved wiki gates remain locked with a review reason', () => {
  const result = P.evaluate({ a: task([], { unresolved: ['Unknown predecessor'] }) });
  assert.equal(result.quests.a.available, false);
  assert.equal(result.quests.a.reasons[0].type, 'unresolved');
});
