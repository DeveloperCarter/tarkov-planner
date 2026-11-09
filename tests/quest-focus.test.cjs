const test = require('node:test'), assert = require('node:assert/strict');
const F = require('../page/quest-focus.js');

const zones = { a: { x: 0, y: 0 }, a2: { x: 10, y: 0 }, b: { x: 100, y: 0 }, c: { x: 200, y: 0 }, d: { x: 300, y: 0 }, far: { x: 900, y: 900 }, nowhere: { name: 'no position' } };
const spot = (id, zone, extra = {}) => ({ id, zone: Array.isArray(zone) ? zone : [zone], ...extra });
const quest = (id, objectives, extra = {}) => ({ id, name: id, objectives, needs: [], ...extra });
const data = extra => ({ zones, meta: { frame: { scale: 2 } }, ...extra });
const route = [quest('q1', [spot('o1', 'a'), spot('o2', 'a2')]), quest('q2', [spot('o3', 'b')]), quest('q3', [spot('o4', 'c')]), quest('q4', [spot('o5', 'd')])];

test('now, next and after chain from where you are; everything else is only a faint spot', () => {
  const p = F.plan(data(), route, { from: { x: -10, y: 0 } });
  assert.deepEqual(p.order, ['q1', 'q2', 'q3', 'q4']);
  assert.deepEqual(p.now.stops.map(s => s.zone), ['a', 'a2'], 'a quest walks its own spots in order');
  assert.deepEqual(p.next.from, { x: 10, y: 0, zone: 'a2', objectives: ['o2'] }, 'the path to the next quest starts at the last spot of this one');
  assert.equal(p.after.id, 'q3');
  assert.deepEqual(p.out, ['d']);
  assert.deepEqual(p.now.from, { x: -10, y: 0 });
});

test('the closest quest to your spawn comes first, whatever the list order', () => {
  assert.deepEqual(F.sequence(data(), route.slice().reverse(), { from: { x: 310, y: 0 } }), ['q4', 'q3', 'q2', 'q1']);
  assert.deepEqual(F.sequence(data(), route.slice().reverse())[0], 'q4', 'with no spawn, the first listed quest starts');
});

test('finished work leaves the path, and a finished quest leaves the order', () => {
  const p = F.plan(data(), route, { done: { o1: true } });
  assert.deepEqual(p.now.stops.map(s => s.zone), ['a2']);
  const later = F.plan(data(), route, { done: { o1: true, o2: true } });
  assert.equal(later.now.id, 'q2');
  assert.deepEqual(F.plan(data(), route, { done: { o1: true, o2: true, o3: true, o4: true, o5: true } }).now, null);
  const counted = [quest('c', [spot('o', 'a', { count: 3 })])];
  assert.equal(F.isOpen(counted[0], { o: 2 }), true, 'a partial counter is still open');
  assert.equal(F.isOpen(counted[0], { o: 3 }), false);
});

test('an any-of objective walks to the nearest spot and rings the others, such as random item spots', () => {
  const p = F.plan(data(), [quest('item', [spot('o', ['a', 'b', 'c'], { zoneMode: 'any' })])], { from: { x: 95, y: 0 } });
  assert.deepEqual(p.now.stops.map(s => s.zone), ['b']);
  assert.deepEqual(p.now.alts.sort(), ['a', 'c']);
});

test('quests with nothing at a spot come last and draw nothing', () => {
  const kill = quest('kill', [{ id: 'k', zone: [], count: 5 }]);
  const p = F.plan(data(), [kill, route[1]], { from: { x: 0, y: 0 } });
  assert.deepEqual(p.order, ['q2', 'kill']);
  assert.deepEqual(p.next.stops, []);
  assert.deepEqual(F.plan(data(), [kill], {}).now.stops, []);
});

test('a chosen quest stays in focus, and the path carries on from it', () => {
  const p = F.plan(data(), route, { focused: 'q3', from: { x: 0, y: 0 } });
  assert.equal(p.now.id, 'q3');
  assert.equal(p.next.id, 'q4');
  assert.equal(p.after, null);
  assert.deepEqual(p.out.sort(), ['a', 'a2', 'b'].sort());
});

test('spots without a position never reach the route', () => {
  const p = F.plan(data(), [quest('q', [spot('o', ['nowhere', 'a'])]), quest('only', [spot('o2', 'nowhere')])], { from: { x: 0, y: 0 } });
  assert.deepEqual(p.now.stops.map(s => s.zone), ['a']);
  assert.deepEqual(p.next.stops, []);
});

test('doors: each required key finds the door nearest the quest, optional keys do not', () => {
  const doors = [{ id: 'near', keyId: 'k1', key: 'Dorm 314', x: 12, y: 0 }, { id: 'far', keyId: 'k1', key: 'Dorm 314', x: 500, y: 0 }, { id: 'opt', keyId: 'k2', key: 'Spare', x: 0, y: 0 }];
  const q = quest('q', [spot('o', 'a')], { needs: [{ kind: 'key', item: 'Dorm 314', itemIds: ['k1'] }, { kind: 'key', item: 'Spare', itemIds: ['k2'], optional: true }, { kind: 'item', item: 'Bolts', itemIds: ['k1'] }, { kind: 'key', item: 'Unknown', itemIds: ['k9'] }] });
  const { now } = F.plan(data({ doors }), [q], { from: { x: 0, y: 0 } });
  assert.deepEqual(now.doors.map(d => [d.id, d.need, d.metres]), [['near', 'Dorm 314', 6]]);
});

test('other quests working at the same stop are named', () => {
  const quests = [quest('q1', [spot('o1', 'a')]), quest('q2', [spot('o2', 'a')]), quest('q3', [spot('o3', 'b')])];
  const { now } = F.plan(data(), quests, { focused: 'q1' });
  assert.deepEqual(now.also.map(a => [a.id, a.zones]), [['q2', ['a']]]);
});

test('finishing the focused quest moves to whichever was next', () => {
  assert.equal(F.advance(['a', 'b', 'c'], ['a', 'b', 'c'], 'b'), 'b');
  assert.equal(F.advance(['a', 'b', 'c'], ['a', 'c'], 'b'), 'c');
  assert.equal(F.advance(['a', 'b', 'c'], ['a'], 'c'), 'a');
  assert.equal(F.advance([], ['x'], null), 'x');
  assert.equal(F.advance(['a'], [], 'a'), null);
});

test('the progress key takes objectives in walking order, then those with no spot, and skips optional ones', () => {
  const q = quest('q', [{ id: 'kill', zone: [], count: 3 }, spot('far', 'b'), spot('near', 'a'), spot('opt', 'a', { optional: true })]);
  const now = done => F.plan(data(), [q], { from: { x: 0, y: 0 }, done }).now;
  assert.equal(F.nextObjective(now({}), {}).id, 'near');
  assert.equal(F.nextObjective(now({ near: true }), { near: true }).id, 'far');
  const left = { near: true, far: true };
  assert.equal(F.nextObjective(now(left), left).id, 'kill', 'no spot comes last');
  const finished = { ...left, kill: 3 };
  assert.equal(F.nextObjective(now(finished), finished), null);
  assert.equal(F.nextObjective(null, {}), null);
  const onlyOptional = quest('o', [spot('a1', 'a', { optional: true })]);
  assert.equal(F.nextObjective(F.plan(data(), [onlyOptional], {}).now, {}).id, 'a1');
});

test('one press is a tick, or one more on a counter that stops at its total', () => {
  assert.equal(F.objectiveValue({ id: 'a' }, {}), true);
  assert.equal(F.objectiveValue({ id: 'c', count: 3 }, {}), 1);
  assert.equal(F.objectiveValue({ id: 'c', count: 3 }, { c: 2 }), 3);
  assert.equal(F.objectiveValue({ id: 'c', count: 3 }, { c: 3 }), 3);
});

test('plain keys map to focus actions; held keys and modifier combinations do not', () => {
  assert.equal(F.keyAction({ key: 'ArrowRight' }), 'photo-next');
  assert.equal(F.keyAction({ key: 'ArrowLeft' }), 'photo-previous');
  assert.equal(F.keyAction({ key: 'PageDown' }), 'objective-next');
  assert.equal(F.keyAction({ key: 'PageUp' }), 'objective-undo');
  for (const extra of [{ repeat: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { metaKey: true }]) assert.equal(F.keyAction({ key: 'PageDown', ...extra }), null);
  assert.equal(F.keyAction({ key: 'ArrowUp' }), null, 'up and down still scroll');
  assert.equal(F.keyAction({ key: 'Enter' }), null);
});

test('focus never touches the quest objects', () => {
  const before = JSON.stringify(route);
  F.plan(data(), route, { from: { x: 0, y: 0 }, done: { o1: true } });
  assert.equal(JSON.stringify(route), before);
});
