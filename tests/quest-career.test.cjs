const test = require('node:test'), assert = require('node:assert/strict');
const Career = require('../page/quest-career.js'), Store = require('../page/progress-store.js');
function fixture() {
  const store = Store.empty();
  const key = Store.createScope(store, {profile:'synthetic',mode:'regular',start:0,label:'Fixture'});
  const map = {key:'customs',name:'Customs',onMap:true,href:'maps/customs.html'};
  const item = {id:'med',name:'Medicine'};
  const task = (id, extra={}) => ({id,name:id,trader:'Therapist',faction:'Any',kappa:true,minLevel:1,maps:[map],keep:[],...extra});
  const tasks = [task('a',{keep:[{id:'a-give',count:3,items:[item]}]}), task('b'), task('c'),
    task('collector',{collector:true,kappa:false,keep:[{id:'collect',count:1,items:[item]}]}),
    task('unknown',{kappa:null}),task('bear',{faction:'BEAR'})];
  const progression = Object.fromEntries(tasks.map(t => [t.id,{requirements:[],minLevel:1,faction:t.faction}]));
  progression.b.requirements=[{task:'a',statuses:['complete']}];
  progression.c.requirements=[{task:'b',statuses:['complete']}];
  progression.collector.minLevel=50;
  const data={mode:'regular',tasks,progression};
  return {store,key,data,item,map};
}
test('Kappa follows completion inference, explicit overrides, faction, wiki coverage and downstream ranking',()=>{
  const {store,key,data}=fixture();
  let r=Career.evaluate(data,store,key,{level:24,faction:'USEC'});
  assert.equal(r.kappa.total,3); assert.equal(r.kappa.completed,0);
  assert.deepEqual(r.kappa.review.map(t=>t.id),['unknown']);
  assert.deepEqual(r.kappa.next.map(t=>[t.id,t.unlocks]),[['a',2]]);
  Store.setManual(store,key,'c','started');
  r=Career.evaluate(data,store,key,{level:24});
  assert.equal(r.kappa.completed,2); assert.equal(r.kappa.implied,2);
  assert.equal(r.kappa.next[0].id,'c');
  Store.setManual(store,key,'a','failed');
  r=Career.evaluate(data,store,key,{level:24});
  assert.equal(r.kappa.completed,1);
  assert.equal(r.kappa.blocked.find(t=>t.id==='a').reasons[0].type,'failed');
  assert.equal(r.kappa.traders[0].completed,1);
});
test('keep list aggregates current/possible/future quantities and preserves alternative groups',()=>{
  const {store,key,data,item}=fixture();
  data.tasks.find(t=>t.id==='b').keep=[{id:'b-give',count:2,items:[item]}];
  data.tasks.find(t=>t.id==='c').keep=[{id:'choice',count:4,items:[item,{id:'alt',name:'Alternative'}]}];
  Store.setManual(store,key,'a','started');
  const before=JSON.stringify(data);
  const r=Career.evaluate(data,store,key,{level:24});
  const med=r.keep.find(row=>row.items.length===1);
  assert.equal(med.current,3); assert.equal(med.later,3); assert.equal(med.possible,0);
  const choice=r.keep.find(row=>row.items.length===2);
  assert.equal(choice.later,4); assert.equal(r.keep.length,2);
  assert.equal(JSON.stringify(data),before);
  data.tasks[0].keep[0].count=null;
  assert.deepEqual(Career.evaluate(data,store,key).keep.find(row=>row.items.length===1).unknown,['current']);
});
test('Collector hand-ins survive serialization, share keep requirements, and isolate profile/mode/wipe',()=>{
  const {store,key,data}=fixture();
  let r=Career.evaluate(data,store,key,{level:24});
  assert.equal(r.keep.find(row=>row.items.length===1).later,1);
  Store.setCollector(store,key,'collect',true);
  const restored=JSON.parse(JSON.stringify(store));
  r=Career.evaluate(data,restored,key,{level:24});
  assert.equal(r.collector[0].checked,true);
  assert.equal(r.keep.find(row=>row.items.length===1).later,0);
  assert.deepEqual(Store.derive(restored,key).statuses,{});
  for (const extra of [{profile:'other',mode:'regular',start:0,label:'Other'},
    {profile:'synthetic',mode:'regular',start:1000,label:'Reset'},
    {profile:'synthetic',mode:'pve',start:0,label:'PvE'}]) {
    const other=Store.createScope(restored,extra);
    const d={...data,mode:extra.mode};
    assert.equal(Career.evaluate(d,restored,other).collector[0].checked,false);
  }
  Store.setCollector(restored,key,'collect',false);
  assert.equal(Career.evaluate(data,restored,key).collector[0].checked,false);
  assert.throws(()=>Store.setCollector(restored,'missing','collect',true),/scope/);
});
test('no scope cannot claim current/completed progress; repeated maps do not multiply counts',()=>{
  const {store,key,data,map}=fixture();
  data.tasks[0].maps.push({...map,key:'woods',name:'Woods',onMap:false});
  Store.setManual(store,key,'a','started');
  const r=Career.evaluate(data,store,key,{level:24});
  assert.equal(r.kappa.maps.customs,1); assert.equal(r.kappa.maps.woods,1);
  assert.equal(r.keep.find(row=>row.items.length===1).current,3);
  const none=Career.evaluate(data,store,'');
  assert.equal(none.scoped,false); assert.equal(none.kappa.completed,0); assert.equal(none.kappa.next.length,0);
  const wrong=Career.evaluate({...data,mode:'pve'},store,key);
  assert.equal(wrong.scoped,false); assert.equal(wrong.kappa.next.length,0);
});
test('confirmed current membership, failed quests, unknown trader loyalty and cycles are handled',()=>{
  const {store,key,data}=fixture();
  Store.setManual(store,key,'a','started',1);
  Store.confirmCurrent(store,key,['a'],[],2,'Customs');
  data.progression.a.traderRequirements=[{trader:'Therapist',type:'level',value:2}];
  let r=Career.evaluate(data,store,key,{level:24});
  assert.equal(r.quests.a.current,false);
  assert.equal(r.keep.find(row=>row.items.length===1).current,0);
  Store.setManual(store,key,'a','failed',3);
  r=Career.evaluate(data,store,key,{level:24});
  assert.equal(r.keep.some(row=>row.quests.some(t=>t.id==='a')),false);
  data.progression.a.restartable=true;
  r=Career.evaluate(data,store,key,{level:24});
  assert.equal(r.kappa.next[0].id,'a');
  assert.equal(r.kappa.next[0].traderRequirements[0].value,2);
  data.progression.a.requirements=[{task:'c',statuses:['complete']}];
  assert.doesNotThrow(()=>Career.evaluate(data,store,key,{level:24}));
});
test('confirming a boundary preserves Collector corrections without copying to another wipe',()=>{
  const {store}=fixture();
  const key=Store.createScope(store,{profile:'manual',mode:'regular',label:'Manual'});
  Store.setCollector(store,key,'collect',true);
  const next=Store.setBoundary(store,key,100);
  assert.equal(store.scopes[next].collector.collect,true);
});
test('saved objective hand-in counters reduce keep totals without treating finds as hand-ins',()=>{
  const {store,key,data}=fixture();
  Store.setManual(store,key,'a','started');
  let r=Career.evaluate(data,store,key,{done:{'a-find':3,'a-give':1}});
  assert.equal(r.keep.find(row=>row.items.length===1).current,2);
  r=Career.evaluate(data,store,key,{done:{'a-give':true}});
  assert.equal(r.keep.some(row=>row.quests.some(t=>t.id==='a')),false);
  assert.equal(r.quests.a.current,true);
});
test('level gates and ranking ties use minimum level; manual completion removes item needs',()=>{
  const {store,key,data}=fixture();
  data.progression.a.minLevel=30;
  let r=Career.evaluate(data,store,key,{level:24});
  assert.equal(r.kappa.blocked.find(t=>t.id==='a').reasons[0].type,'level');
  Store.setManual(store,key,'a','completed');
  r=Career.evaluate(data,store,key,{level:24});
  assert.equal(r.keep.some(row=>row.quests.some(t=>t.id==='a')),false);
  assert.equal(r.kappa.completed,1);
  assert.equal(r.kappa.next[0].id,'b');
});
test('accepted Kappa quests lead the next list ahead of possible unlocks with more downstream',()=>{
 const {store,key,data}=fixture();
 Store.setManual(store,key,'d','started');
 data.tasks.push({...data.tasks[0],id:'d',name:'d',keep:[]}); data.progression.d={requirements:[],minLevel:1};
 const r=Career.evaluate(data,store,key,{level:24});
 assert.deepEqual(r.kappa.next.map(t=>[t.id,t.current,t.unlocks]),[['d',true,0],['a',false,2]]);
});
