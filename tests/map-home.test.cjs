const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const H = require('../page/map-home.js');
const S = require('../page/progress-store.js');
const tree = {a:{}, b:{requirements:[{task:'a',statuses:['complete']}]}, c:{minLevel:20}, d:{faction:'BEAR'}};
const maps = [{name:'Customs',ids:['a','b','c','d'],href:'maps/customs.html'}, {name:'Woods',ids:['b']}];
const data = {player:{level:1,faction:'USEC'},modes:{regular:{progression:tree,maps},
  pve:{progression:{...tree,c:{minLevel:30}},maps}}};
function setup() {
  const store = S.empty();
  const create = (mode,start=100,profile='a'.repeat(24)) => S.createScope(store,{mode,start,profile,label:`Wipe ${start}`});
  return {store,create};
}

test('empty home has no current list and does not offer predictions without a scope', () => {
  const store = S.empty();
  assert.deepEqual(H.summarize(data,store,'regular').map(m=>[m.current,m.possible]),[[0,0],[0,0]]);
  assert.deepEqual(store,S.empty());
});
test('home matches map evaluation including current corrections, inferred history and cross-map tasks', () => {
  const {store,create} = setup(), key = create('regular');
  S.setManual(store,key,'b','started',150);
  assert.deepEqual(H.summarize(data,store,'regular').map(m=>[m.current,m.possible]),[[1,0],[1,0]]);
  S.confirmCurrent(store,key,['b'],[],160,'Customs');
  assert.deepEqual(H.summarize(data,store,'regular').map(m=>m.current),[0,1]);
  assert.equal(S.derive(store,key).statuses.b.status,'started','membership is not completion');
});
test('cards count located quests as current and multi-map quests separately, ignoring old map lists for the latter', () => {
  const {store,create} = setup(), key = create('regular');
  const split = {...data, modes:{regular:{progression:tree, maps:[{name:'Customs',ids:['a','b'],onMap:['a']}]}}};
  S.setManual(store,key,'a','started',150); S.setManual(store,key,'b','started',150);
  S.confirmCurrent(store,key,['a','b'],['a'],160,'Customs');
  assert.deepEqual(H.summarize(split,store,'regular').map(m=>[m.current,m.multiMap]),[[1,1]]);
});
test('trader and Kappa filters count only matching quests and list them per card', () => {
  const {store,create} = setup(), key = create('regular');
  const quests = {a:{name:'Alpha',trader:'Prapor',kappa:true}, b:{name:'Bravo',trader:'Jaeger',kappa:false}, c:{name:'Charlie',trader:'Prapor'}};
  const named = {...data, modes:{regular:{progression:tree, quests, maps:[{name:'Customs',ids:['a','b','c'],onMap:['a','b','c']}, {name:'Woods',ids:['b']}]}}};
  S.setManual(store,key,'a','started',150); S.setManual(store,key,'b','started',150);
  let cards = H.summarize(named,store,'regular');
  assert.deepEqual(cards.map(m=>m.current),[2,1]);
  assert.deepEqual(cards[0].matches.map(q=>q.name),['Alpha','Bravo']);
  assert.deepEqual(H.traders(cards),[{name:'Jaeger',count:1},{name:'Prapor',count:1}]);
  cards = H.summarize(named,store,'regular',key,{},{trader:'Prapor'});
  assert.deepEqual(cards.map(m=>[m.current,m.multiMap]),[[1,0],[0,0]]);
  assert.deepEqual(H.summarize(named,store,'regular',key,{},{kappa:true}).map(m=>m.current),[1,0],'only wiki-confirmed Kappa');
  assert.deepEqual(H.summarize(named,store,'regular',key,{},{trader:'Jaeger',kappa:true}).map(m=>m.current),[0,0]);
});
test('same IDs in PvP and PvE stay isolated, including wrongly assigned active keys', () => {
  const {store,create} = setup(), regular = create('regular'), pve = create('pve');
  S.ingest(store,[{questId:'a',status:'started',at:110,key:'pvp'}],{profileId:'a'.repeat(24),mode:'regular'});
  S.ingest(store,[{questId:'b',status:'started',at:120,key:'pve'}],{profileId:'a'.repeat(24),mode:'pve'});
  assert.equal(H.summarize(data,store,'regular')[0].current,1);
  assert.equal(H.summarize(data,store,'pve')[1].current,1);
  assert.equal(H.summarize(data,store,'regular')[1].current,0);
  assert.equal(H.summarize(data,store,'pve',regular)[0].current,0);
  assert.equal(H.summarize(data,store,'regular',pve)[0].possible,0);
});
test('profile/wipe selection and saved level change the same estimates as map pages', () => {
  const {store,create} = setup(), old = create('regular',0), now = create('regular',100);
  S.setManual(store,old,'c','started',20);
  assert.equal(H.summarize(data,store,'regular',old)[0].current,1);
  assert.equal(H.summarize(data,store,'regular',now)[0].current,0);
  assert.equal(H.summarize(data,store,'regular',now,{[now]:24})[0].possible,2);
  assert.equal(H.summarize(data,store,'regular',now,{[now]:0})[0].possible,1);
  const other = create('regular',100,'b'.repeat(24));
  assert.equal(H.summarize(data,store,'regular',other)[0].current,0);
  const pve = create('pve');
  assert.equal(H.summarize(data,store,'pve',pve,{[pve]:24})[0].possible,1,'PvE uses its own level gates');
});
test('summarizing never changes statuses, selections, membership or journal', () => {
  const {store,create} = setup(), key = create('regular');
  S.setManual(store,key,'b','started',150);
  store.scopes[key].raidFocus = {Customs:[]};
  const before = JSON.stringify(store);
  H.summarize(data,store,'regular'); H.summarize(data,store,'pve');
  assert.equal(JSON.stringify(store),before);
});
test('freshness uses the source date, not the build date; UMD exports in the browser', () => {
  assert.match(H.freshness('2026-10-20T00:00:00Z',Date.parse('2026-10-21T01:00:00Z')),/more than/);
  assert.match(H.freshness('2026-10-20T00:00:00Z',Date.parse('2026-10-20T12:00:00Z')),/less than/);
  assert.match(H.freshness('bad'),/unavailable/);
  const context = {ProgressStore:S}; vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../page/map-home.js'),'utf8'),context);
  assert.equal(typeof context.MapHome.summarize,'function');
});
