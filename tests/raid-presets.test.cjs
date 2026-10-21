const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../page/raid-presets.js');
const current=[
 {id:'item',bsgId:'item-bsg',needs:[{kind:'key',item:'Required key'}],objectives:[{id:'pickup',type:'findQuestItem',zone:['a']}]},
 {id:'place',needs:[{kind:'key',optional:true}],objectives:[{id:'mark',type:'mark',zone:['b'],count:3}]},
 {id:'kill',needs:[],objectives:[{id:'kill-o',type:'shoot',count:5}]},
 {id:'visit',needs:[],objectives:[{id:'visit-o',type:'visit',zone:['c']}]},
 {id:'handover',needs:[],objectives:[{id:'give',type:'giveItem'}]},
];
test('presets classify required keys, located pickups, placements and combat using stable IDs',()=>{
 const before=JSON.stringify(current);
 assert.deepEqual(P.choose(current,'keys'),['item-bsg']);
 assert.deepEqual(P.choose(current,'items'),['item-bsg']);
 assert.deepEqual(P.choose(current,'placements'),['place']);
 assert.deepEqual(P.choose(current,'combat'),['kill']);
 assert.deepEqual(P.choose(current,'no-keys'),['handover','kill','place','visit']);
 assert.equal(P.choose(current,'all').length,5);
 assert.equal(JSON.stringify(current),before);
});
test('done counters and optional work do not qualify for objective presets',()=>{
 assert.deepEqual(P.choose(current,'placements',{mark:2}),['place']);
 assert.deepEqual(P.choose(current,'placements',{mark:3}),[]);
 assert.deepEqual(P.choose(current,'items',new Set(['pickup'])),[]);
 assert.deepEqual(P.choose(current,'keys',new Set(['pickup'])),[]);
 assert.deepEqual(P.choose(current,'combat',{ 'kill-o':5 }),[]);
 const optional=[{id:'optional',needs:[],objectives:[{id:'x',type:'mark',optional:true}]}];
 assert.deepEqual(P.choose(optional,'placements'),[]);
});
test('preset candidates are only supplied current quests; membership, order and empty selection are explicit',()=>{
 assert.deepEqual(P.choose([current[1]],'keys'),[]);
 assert.deepEqual(P.choose([],'all'),[]);
 assert.deepEqual(P.choose([...current].reverse(),'all'),P.choose(current,'all'));
 assert.throws(()=>P.choose(current,'unknown'),/Unknown/);
 assert.equal(P.list(current).every(p=>p.description && p.name),true);
});
