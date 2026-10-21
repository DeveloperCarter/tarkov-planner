const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../page/raid-session.js'),R=require('../page/raid-route.js');
const data={meta:{key:'customs',rotation:90,frame:{scale:2}},spawns:[{gx:10,gz:20,x:100,y:200,area:'a'}],
  spawnAreas:[{id:'a',x:100,y:200}],zones:{z:{gx:12,gz:23,x:94,y:196}},
  quests:[{id:'q',objectives:[{id:'o',zone:['z']}]}]};
test('live raid state resets for each raid, rejects other maps and accepts close early positions',()=>{
 let s=S.empty();assert.equal(S.reduce(s,data,{kind:'raid-started',map:'woods',at:1}),s);
 s=S.reduce(s,data,{kind:'raid-started',map:'customs',at:1000});
 assert.equal(S.needsArea(s,10999),false);assert.equal(S.needsArea(s,11000),true);
 assert.equal(S.reduce(s,data,{kind:'spawn-position',map:'customs',at:12000,x:10,z:20}),s);
 s=S.reduce(s,data,{kind:'spawn-position',map:'customs',at:4000,x:11,z:19});
 assert.deepEqual(s.start,{gx:10,gz:20});assert.equal(s.source,'log');assert.equal(S.needsArea(s,15000),false);
 assert.deepEqual(S.reduce(s,data,{kind:'raid-loading',map:'customs',at:20000}),S.empty());
});
test('missing or distant positions prompt for an area; explicit choice wins over a later position',()=>{
 let s=S.reduce(S.empty(),data,{kind:'raid-started',map:'customs',at:0});
 s=S.reduce(s,data,{kind:'spawn-position',map:'customs',at:3000,x:100,z:200});
 assert.equal(S.needsArea(s,3000),true);
 s=S.choose(s,data,'a');assert.equal(s.source,'manual');
 assert.equal(S.reduce(s,data,{kind:'spawn-position',map:'customs',at:4000,x:10,z:20}),s);
 assert.equal(S.choose(s,data,'').start,null);assert.throws(()=>S.choose(s,data,'unknown'));
});
test('completion reroutes from the last completed prefix stop, not a later checked stop',()=>{
 const route=R.route(data,['q'],'a');const s=S.choose(S.empty(),data,'a');
 assert.equal(S.advance(s,route.stops,new Set()),s);
 const next=S.advance(s,route.stops,new Set(['o']));assert.deepEqual(next.start,{gx:12,gz:23});
 assert.equal(next.source,'objective');assert.deepEqual(R.route(data,['q'],next.start,{done:new Set(['o'])}).stops,[]);
 const two=[{gx:1,gz:2,objectives:['first']},{gx:3,gz:4,objectives:['second']}];
 assert.equal(S.advance(s,two,new Set(['second'])),s);
});
test('start markers respect rotation, frame scale and manual areas',()=>{
 assert.deepEqual(S.marker(data,'a'),data.spawnAreas[0]);
 const p=S.marker(data,{gx:12,gz:23});assert.ok(Math.abs(p.x-94)<1e-8);assert.ok(Math.abs(p.y-196)<1e-8);
 assert.equal(S.marker(data,null),null);
});
