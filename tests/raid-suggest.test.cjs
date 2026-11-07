const test = require('node:test'), assert = require('node:assert/strict');
const S = require('../page/raid-suggest.js');

const zones = {
  a: { name: 'Dorms', gx: 0, gz: 0 }, a2: { name: 'Dorms E', gx: 40, gz: 0 }, b: { name: 'Gas', gx: 500, gz: 0 },
  b2: { name: 'Gas N', gx: 500, gz: 50 }, far: { name: 'Far', gx: 2000, gz: 0 }, flat: { name: 'No coordinates' },
};
const spot = (id, zone, extra = {}) => ({ id, type: 'visit', zone: Array.isArray(zone) ? zone : [zone], ...extra });
const quest = (id, objectives, extra = {}) => ({ id, name: id, objectives, rewards: { xp: 1000, rep: [] }, needs: [], ...extra });
const names = list => list.map(q => q.id).sort();

test('every quest lands in exactly one place', () => {
  const quests = [quest('d1', [spot('o1', 'a')]), quest('d2', [spot('o2', 'a2')]), quest('g1', [spot('o3', 'b')]), quest('g2', [spot('o4', 'b2')]),
    quest('alone', [spot('o5', 'far')]), quest('kill', [{ id: 'o6', type: 'shoot', zone: [] }])];
  const p = S.plan({ zones }, quests);
  assert.deepEqual(p.raids.map(r => r.ids.slice().sort()), [['d1', 'd2'], ['g1', 'g2']]);
  assert.deepEqual(names(p.elsewhere), ['alone']);
  assert.deepEqual(names(p.anyRaid), ['kill']);
  const seen = [...p.raids.flatMap(r => r.ids), ...names(p.elsewhere), ...names(p.anyRaid)].sort();
  assert.deepEqual(seen, quests.map(q => q.id).sort());
});

test('a lone quest is not a raid, and zones without coordinates only match themselves', () => {
  assert.deepEqual(S.plan({ zones }, [quest('solo', [spot('o', 'a')])]).raids, []);
  const p = S.plan({ zones }, [quest('x', [spot('o1', 'flat')]), quest('y', [spot('o2', 'flat')]), quest('z', [spot('o3', 'a')])]);
  assert.deepEqual(p.raids.map(r => r.ids), [['x', 'y']]);
  assert.deepEqual(names(p.elsewhere), ['z']);
});

test('finish means all located work is here, counting one spot of an any-of list', () => {
  const quests = [quest('here', [spot('o1', 'a'), spot('o2', 'a2')]), quest('alt', [spot('o3', ['far', 'a'])]),
    quest('split', [spot('o4', 'a'), spot('o5', 'far')]), quest('multi', [spot('o6', 'a')], { onMap: false }), quest('all', [spot('o7', ['a', 'far'], { zoneMode: 'all' })])];
  const [raid] = S.plan({ zones }, quests).raids;
  assert.deepEqual(raid.ids.slice().sort(), ['alt', 'here', 'multi', 'split']);
  assert.deepEqual(raid.finish.slice().sort(), ['alt', 'here'], 'split has a far spot; multi needs other maps');
});

test('a quest counts by its share of the work, so a quarter of a quest loses to a whole one', () => {
  const quests = [quest('q1', [spot('o1', 'a'), spot('o2', 'far'), spot('o3', 'far'), spot('o4', 'far')]), quest('q2', [spot('o5', 'a'), spot('o6', 'far'), spot('o7', 'far'), spot('o8', 'far')]),
    quest('w1', [spot('o9', 'b')]), quest('w2', [spot('o10', 'b2')])];
  const p = S.plan({ zones }, quests);
  assert.deepEqual(p.raids[0].ids, ['w1', 'w2']);
});

test('finished and optional objectives no longer pull a quest to a spot', () => {
  const quests = [quest('q1', [spot('o1', 'a'), spot('o2', 'far', { count: 2 })]), quest('q2', [spot('o3', 'a2')]), quest('opt', [spot('o4', 'far', { optional: true })])];
  const open = S.plan({ zones }, quests);
  assert.equal(open.raids[0].finish.includes('q1'), false);
  const later = S.plan({ zones }, quests, { done: { o2: 2 } });
  assert.deepEqual(later.raids[0].finish.slice().sort(), ['q1', 'q2']);
  assert.deepEqual(names(later.anyRaid), ['opt']);
  assert.deepEqual(names(S.plan({ zones }, quests, { done: { o1: true, o2: 2, o3: true } }).anyRaid), ['opt', 'q1', 'q2']);
});

test('the aim changes which raid comes first and what the card adds up', () => {
  const rep = (trader, standing) => [{ trader, standing }];
  const quests = [quest('d1', [spot('o1', 'a')], { rewards: { xp: 100, rep: rep('Prapor', 0.9) } }), quest('d2', [spot('o2', 'a2')], { rewards: { xp: 100, rep: rep('Skier', 0.1) } }),
    quest('d3', [spot('o3', 'a')], { rewards: { xp: 100, rep: [] } }), quest('g1', [spot('o4', 'b')], { rewards: { xp: 9000, rep: rep('Skier', 0.2) } }), quest('g2', [spot('o5', 'b2')], { rewards: { xp: 9000, rep: rep('Skier', 0.4) } })];
  const first = aim => S.plan({ zones }, quests, { aim }).raids[0];
  assert.equal(first('quests').ids.length, 3);
  assert.deepEqual(first('xp').ids, ['g1', 'g2']);
  assert.equal(first('xp').xp, 18000);
  assert.equal(first('rep').ids.length, 3, 'Dorms adds up to 1.0 standing, Gas to 0.6');
  assert.equal(first('rep:Prapor').ids.length, 3);
  assert.equal(first('rep:Prapor').rep, 0.9, 'only that trader counts');
  assert.deepEqual(first('rep:Skier').ids, ['g1', 'g2']);
  assert.equal(S.normalizeAim('nonsense'), 'quests');
  assert.equal(S.normalizeAim('rep:Ref'), 'rep:Ref');
  assert.equal(S.normalizeAim('rep:'), 'quests');
  assert.equal(S.normalizeAim('toString'), 'quests');
});

test('keys list once per raid and optional keys stay out', () => {
  const key = (item, optional) => ({ kind: 'key', item, optional });
  const quests = [quest('k1', [spot('o1', 'a')], { needs: [key('Dorm 314'), { kind: 'item', item: 'Bolts' }] }), quest('k2', [spot('o2', 'a2')], { needs: [key('Dorm 314'), key('Spare', true)] })];
  assert.deepEqual(S.plan({ zones }, quests).raids[0].keys, ['Dorm 314']);
});

test('groups name the most central spot, and the raid limit leaves the rest elsewhere', () => {
  const line = { w: { name: 'West', gx: 0, gz: 0 }, m: { name: 'Middle', gx: 50, gz: 0 }, e: { name: 'East', gx: 100, gz: 0 } };
  const p = S.plan({ zones: line }, [quest('q1', [spot('o1', 'w')]), quest('q2', [spot('o2', 'm')]), quest('q3', [spot('o3', 'e')])]);
  assert.equal(p.raids[0].name, 'Middle');
  assert.deepEqual(p.raids[0].zones.slice().sort(), ['e', 'm', 'w']);
  const many = S.plan({ zones }, [quest('d1', [spot('o1', 'a')]), quest('d2', [spot('o2', 'a')]), quest('g1', [spot('o3', 'b')]), quest('g2', [spot('o4', 'b')])], { limit: 1 });
  assert.equal(many.raids.length, 1);
  assert.equal(many.elsewhere.length, 2);
});

test('choosing a raid replaces spot quests and keeps flexible ones', () => {
  const quests = [quest('d1', [spot('o1', 'a')]), quest('d2', [spot('o2', 'a')]), quest('g', [spot('o3', 'b')]), quest('kill', [{ id: 'o4', zone: [] }])];
  const [raid] = S.plan({ zones }, quests).raids, flexible = S.flexible({ zones }, quests);
  assert.deepEqual(flexible, ['kill']);
  const next = S.choose(raid, ['g', 'kill'], flexible);
  assert.deepEqual(next.slice().sort(), ['d1', 'd2', 'kill']);
  assert.equal(S.chosen(raid, next, flexible), true);
  assert.equal(S.chosen(raid, ['d1', 'd2', 'g'], flexible), false, 'another spot quest means it is not just this raid');
  assert.equal(S.chosen(raid, ['d1'], flexible), false);
});

test('planning never touches the quest objects', () => {
  const q = quest('d1', [spot('o1', 'a')]), before = JSON.stringify(q);
  S.plan({ zones }, [q, quest('d2', [spot('o2', 'a')])], { aim: 'xp' });
  assert.equal(JSON.stringify(q), before);
});

test('a card says how many quests finish', () => {
  assert.equal(S.finishText({ finish: [] }), 'none finish here');
  assert.equal(S.finishText({ finish: ['a'] }), '1 finishes here');
  assert.equal(S.finishText({ finish: ['a', 'b'] }), '2 finish here');
});

test('finishable: one area holds all the work left, and multi-map quests never do', () => {
  const data = { zones };
  assert.equal(S.finishable(data, quest('near', [spot('o1', 'a'), spot('o2', 'a2')])), true);
  assert.equal(S.finishable(data, quest('split', [spot('o1', 'a'), spot('o2', 'far')])), false);
  assert.equal(S.finishable(data, quest('split', [spot('o1', 'a'), spot('o2', 'far')]), { done: { o2: true } }), true, 'finished work no longer counts');
  assert.equal(S.finishable(data, quest('alt', [spot('o1', 'a'), spot('o2', ['far', 'a2'])])), true, 'one spot of an any-of list is enough');
  assert.equal(S.finishable(data, quest('kill', [{ id: 'o1', type: 'shoot', zone: [] }])), true, 'nothing located left fits any raid');
  assert.equal(S.finishable(data, quest('multi', [spot('o1', 'a')], { onMap: false })), false);
});

test('whole raids hold only the quests their area finishes', () => {
  const quests = [quest('d1', [spot('o1', 'a')]), quest('d2', [spot('o2', 'a2')]), quest('split', [spot('o3', 'a'), spot('o4', 'far')]), quest('multi', [spot('o5', 'a')], { onMap: false })];
  const [part] = S.plan({ zones }, quests).raids, [whole] = S.plan({ zones }, quests, { whole: true }).raids;
  assert.equal(part.ids.length, 4);
  assert.deepEqual(whole.ids.slice().sort(), ['d1', 'd2']);
  assert.deepEqual(whole.finish.slice().sort(), ['d1', 'd2']);
});

test('an area can centre on another quest spot, so quests at either end of a building still group', () => {
  const line = { w: { name: 'West wing', gx: 0, gz: 0 }, mid: { name: 'Resort', gx: 90, gz: 0 }, e: { name: 'East wing', gx: 180, gz: 0 } };
  const pair = [quest('west', [spot('o1', 'w')]), quest('east', [spot('o2', 'e')])];
  assert.deepEqual(S.plan({ zones: line, quests: pair }, pair).raids, [], 'their own spots are 180 m apart');
  const map = { zones: line, quests: [...pair, quest('other', [spot('o3', 'mid')])] };
  const [raid] = S.plan(map, pair, { whole: true }).raids;
  assert.equal(raid.name, 'Resort');
  assert.deepEqual(raid.finish.slice().sort(), ['east', 'west']);
});
