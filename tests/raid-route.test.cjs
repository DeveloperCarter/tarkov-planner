const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../page/raid-route.js');
const L = require('../page/eft-log-tracker.js');

const line = (time, body) => `2026-01-02 10:00:${time} +00:00|Info|application|${body}\n`;
const loading = (time, map) => line(time, `TRACE-NetworkGameCreate profileStatus: 'Profileid: ${'a'.repeat(24)}, Status: Busy, RaidMode: Online, Location: ${map}, GameMode: deathmatch, shortId: SYN001'`);
const started = time => line(time, 'GameStarted:61.5(9.65) real:77.92(12.04) diff:16.41');
const position = (time, reason = 'PacketsQueue') => line(time, `Reason:${reason}, Position:(-119.584, 0.059, -443.700), SpeedLimit:0.65`);

test('raid parsing: two raids, first position only, ten-second window and no identity leakage', () => {
  const text = loading('00.000', 'bigmap') + started('02.000') + position('05.000') + position('06.000', 'Lift') +
    loading('10.000', 'Woods') + started('12.000') + position('52.000', 'Speed');
  const events = L.raidEventsFromText(text);
  assert.deepEqual(events.map(e => e.kind), ['raid-loading', 'raid-started', 'spawn-position', 'raid-loading', 'raid-started']);
  assert.equal(events[2].secondsAfterStart, 3);
  assert.equal(events[2].x, -119.584);
  assert.equal(events[2].map, 'customs');
  assert.equal(events[4].map, 'woods');
  assert.ok(!JSON.stringify(events).includes('SYN001'));
  assert.ok(!JSON.stringify(events).includes('a'.repeat(24)));
  assert.deepEqual(Object.keys(events[2]).sort(), ['kind','map','x','y','z','at','secondsAfterStart','reason'].sort());
  const parser = new L.RaidParser(), chunked = [];
  for (let i = 0; i < text.length; i += 7) chunked.push(...parser.push(text.slice(i, i + 7)));
  chunked.push(...parser.flush());
  assert.deepEqual(chunked, events);
});

test('raid location IDs match snapshot names, unknown maps remain unknown and all position reasons work', () => {
  const mapping = {bigmap:'customs',TarkovStreets:'streets-of-tarkov',Woods:'woods',Shoreline:'shoreline',
    laboratory:'the-lab',laboratory_dark:'the-lab',factory4_day:'factory',factory4_night:'factory',Labyrinth:'the-labyrinth',
    Interchange:'interchange',RezervBase:'reserve',Lighthouse:'lighthouse',Sandbox:'ground-zero',
    Sandbox_high:'ground-zero',Sandbox_start:'ground-zero',Icebreaker:'icebreaker',Terminal:'terminal'};
  for (const [name, key] of Object.entries(mapping)) assert.equal(L.raidMap(name), key);
  assert.equal(L.raidEventsFromText(loading('00.000','FutureMap'))[0].map, null);
  for (const reason of ['Lift', 'Speed', 'PacketsQueue']) {
    assert.equal(L.raidEventsFromText(loading('00.000','bigmap') + started('01.000') + position('11.000',reason)).at(-1).reason,reason);
  }
  assert.equal(L.raidEventsFromText(position('01.000')).length,0);
});

function data(points, objectives) {
  return {zones:Object.fromEntries(points.map(([id,gx,gz]) => [id,{x:gx*2,y:-gz*2,gx,gz}])),
    quests:[{id:'q', objectives:objectives || points.map(([id]) => ({id:'o-'+id,zone:[id]}))}],
    spawns:[{x:0,y:0,gx:0,gz:0,area:'area'}],spawnAreas:[{id:'area',x:0,y:0,count:1}],
    meta:{frame:{scale:2},rotation:0}};
}
function brute(points, start={gx:0,gz:0}) {
  if (!points.length) return 0;
  return Math.min(...points.map((p,i) => Math.hypot(p.gx-start.gx,p.gz-start.gz)+brute(points.filter((_,j)=>j!==i),p)));
}

test('exact open route matches brute force and stops at the last objective', () => {
  for (let size = 1; size <= 7; size++) {
    const d = data(Array.from({length:size},(_,i)=>['z'+i,(i*17)%31-15,(i*13)%29-14]));
    const result = R.route(d,['q'],{gx:0,gz:0});
    assert.ok(Math.abs(result.metres-brute(Object.values(d.zones)))<1e-8);
    assert.equal(result.stops.length,size);
    assert.equal(result.approximate,undefined);
  }
});

test('alternatives are optimized globally, shared stops merge and explicit all needs every zone', () => {
  const d = data([['a',-1,0],['b',2,0],['c',10,0]], [
    {id:'alt',zone:['a','b']},{id:'end',zone:['c']}]);
  assert.deepEqual(R.route(d,['q'],'area').stops.map(s=>s.zone),['b','c']);
  d.quests.push({id:'second',bsgId:'second-bsg',objectives:[{id:'shared',zone:['b']}]});
  const r = R.route(d,['q','second-bsg'],'area');
  assert.deepEqual(r.stops.map(s=>s.zone),['b','c']);
  assert.deepEqual(r.stops[0].objectives,['alt','shared']);
  assert.deepEqual(r.stops[0].quests,['q','second-bsg']);
  assert.equal(r.metres,10);
  d.quests[0].objectives[0].zoneMode='all';
  assert.equal(R.route(d,['q'],{gx:0,gz:0}).stops.length,3);
});

test('done sets and counted progress remove only finished objectives; re-route from last stop', () => {
  const d = data([['a',1,0],['b',5,0]], [{id:'counter',zone:['a'],count:3,type:'shoot'},
    {id:'finish',zone:['b']},{id:'non-spatial',type:'shoot',count:5}]);
  const before = R.route(d,['q'],'area',{done:{counter:2}});
  assert.equal(before.stops.length,2);
  assert.deepEqual(R.route(d,['q'],before.stops[0],{done:new Set(['counter'])}).stops.map(s=>s.zone),['b']);
  assert.equal(R.route(d,['q'],before.stops[0],{done:{counter:3}}).metres,4);
  assert.equal(R.route(d,['q'],'area',{done:new Map([['counter',{count:3}],['finish',true]])}).stops.length,0);
  assert.deepEqual(R.route(d,[],null),{stops:[],metres:0});
});

test('ties and input ordering are deterministic; >10 distinct requirements are approximate', () => {
  const d = data([['b',-1,0],['a',1,0]]);
  assert.equal(R.route(d,['q'],'area').stops[0].zone,'a');
  const first = R.route(d,['q'],'area');
  d.quests[0].objectives.reverse();
  assert.deepEqual(R.route(d,['q'],'area'),first);
  const large = data(Array.from({length:11},(_,i)=>['z'+i,Math.cos(i)*20,Math.sin(i)*20]));
  const result=R.route(large,['q'],'area');
  assert.equal(result.approximate,true);
  assert.equal(new Set(result.stops.map(s=>s.zone)).size,11);
  assert.deepEqual(R.route(large,['q'],'area'),result);
  large.quests[0].objectives.pop();
  assert.equal(R.route(large,['q'],'area').approximate,undefined);
});

test('spawn matching in raw metres accepts 30m, rejects farther and resolves ties stably', () => {
  const d=data([]);d.spawns.push({x:4,y:0,gx:2,gz:0,area:'other'});
  assert.equal(R.matchSpawn(d,1,0).spawn.area,'area');
  assert.equal(R.matchSpawn(d,-30,0).metres,30);
  assert.equal(R.matchSpawn(d,-30.01,0),null);
  assert.equal(R.matchSpawn(d,NaN,0),null);
  assert.equal(R.matchSpawn({},0,0),null);
  assert.throws(()=>R.route(data([['a',1,1]]),['q'],'unknown'),/Unknown spawn area/);
});

test('many alternative objectives on ten or fewer zones are still exact and UMD exports in browser',()=>{
  const vm=require('node:vm'),fs=require('node:fs');
  const context={};vm.runInNewContext(fs.readFileSync(require.resolve('../page/raid-route.js'),'utf8'),context);
  assert.equal(typeof context.RaidRoute.route,'function');
  const d=data([['a',1,0],['b',3,0],['c',5,0],['d',7,0],['e',9,0],['f',11,0]]);
  d.quests[0].objectives=[];
  for(const a of Object.keys(d.zones)) for(const b of Object.keys(d.zones)) if(a<b)
    d.quests[0].objectives.push({id:a+b,zone:[a,b]});
  const result=R.route(d,['q'],'area');
  assert.equal(result.approximate,undefined);
  assert.equal(result.metres,9);
  assert.equal(result.stops.length,5);
});

test('alternative-route optimum matches brute-force subsets and permutations',()=>{
  const d=data([['a',-2,3],['b',8,4],['c',-6,-1],['d',1,-8],['e',9,-3]],
    [{id:'one',zone:['a','b']},{id:'two',zone:['b','c','d']},{id:'three',zone:['d','e']}]);
  let best=Infinity;
  const ids=Object.keys(d.zones);
  for(let mask=1;mask<(1<<ids.length);mask++) {
    const included=ids.filter((_,i)=>mask&(1<<i));
    if(d.quests[0].objectives.every(o=>o.zone.some(z=>included.includes(z))))
      best=Math.min(best,brute(included.map(z=>d.zones[z])));
  }
  assert.ok(Math.abs(R.route(d,['q'],'area').metres-best)<1e-8);
});

test('optional visits do not add detours to required objective routes',()=>{
 const d=data([['a',1,0],['b',100,0]],[{id:'required',zone:['a']},{id:'optional',zone:['b'],optional:true}]);
 assert.deepEqual(R.route(d,['q'],'area').stops.map(s=>s.zone),['a']);
 assert.deepEqual(R.route(d,['q'],'area',{done:new Set(['required'])}).stops,[]);
});
