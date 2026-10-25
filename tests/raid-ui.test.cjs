// Execute the actual DOM integration handlers with a small synthetic browser boundary.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ProgressStore=require('../page/progress-store.js'),RaidSession=require('../page/raid-session.js');
const source=fs.readFileSync(require.resolve('../page/customs-raid-plan.template.html'),'utf8').replace(/\r\n/g,'\n');
const extract=name=>source.match(new RegExp('function '+name+'\\([^]*?\\n}'))[0];
function harness(){
 const profile='b'.repeat(24),progressStore=ProgressStore.empty();
 const scopeKey=ProgressStore.createScope(progressStore,{profile,mode:'regular',start:0,label:'Synthetic'});
 let now=1000,timer,rendered=0,prompted=0;const writes=[];
 const dialog={open:false,close(){this.open=false},showModal(){this.open=true;prompted++}};
 const choice={innerHTML:''};
 const c={ProgressStore,RaidSession,progressStore,scopeKey,spawnWait:null,objectiveRoute:null,raidOn:false,
  DATA:{meta:{key:'customs'},spawns:[{gx:0,gz:0,area:'a'}],spawnAreas:[{id:'a',name:'Near fixture'}]},
  MAP:'Customs',currentQuests:[{id:'q'}],qd:{open:false},routeSession:RaidSession.empty(),
  document:{getElementById:id=>id==='spawnDialog'?dialog:choice,querySelectorAll:()=>[{value:'woods.html',textContent:'Woods'}]},location:{href:''},Date:{now:()=>now},
  sessionStorage:{setItem:(key,value)=>writes.push([key,value]),removeItem:key=>writes.push([key,null])},
  canRoute:()=>true,esc:s=>s,setTimeout:(fn,ms)=>{timer={fn,ms};return 1},clearTimeout:()=>{timer=null},
  renderQuests:()=>rendered++,renderRoutePlanner:()=>{},renderRaidPanel:()=>{},clock:()=>{},toast:t=>c.toasts.push(t),autoRaidOn:()=>false,ROUTE_KEY:'eft-raid-route:regular:customs',toasts:[],raidStart:0};
 vm.createContext(c);vm.runInContext(extract('promptSpawn')+'\n'+extract('raidElsewhere')+'\n'+extract('handleRaidEvent'),c);
 const meta={profileId:profile,mode:'regular',identityConflict:false,session:'synthetic'};
 return {c,meta,dialog,writes,get timer(){return timer},get rendered(){return rendered},get prompted(){return prompted},setNow:n=>now=n};
}
test('actual UI handler isolates identity/mode/wipe, prompts after ten seconds, and accepts an early spawn',()=>{
 const h=harness(),{c,meta}=h;
 const start={kind:'raid-started',map:'customs',at:1000};
 c.handleRaidEvent(start,{...meta,profileId:'c'.repeat(24)});assert.equal(h.rendered,0);
 c.handleRaidEvent(start,{...meta,mode:'pve'});assert.equal(h.rendered,0);
 c.handleRaidEvent(start,{...meta,identityConflict:true});assert.equal(h.rendered,0);
 c.handleRaidEvent({...start,at:-1},meta);assert.equal(h.rendered,0);
 c.handleRaidEvent(start,meta);assert.equal(h.timer.ms,10000);
 h.dialog.returnValue='choose';h.setNow(11000);h.timer.fn();assert.equal(h.prompted,1);assert.equal(h.dialog.returnValue,'');
 c.handleRaidEvent({kind:'spawn-position',map:'customs',at:4000,x:1,z:1},meta);
 assert.equal(c.routeSession.source,'log');assert.equal(h.dialog.open,false);
 assert.equal(h.writes.length,1);assert.match(h.writes[0][0],/^eft-raid-start:/);
 assert.equal(h.writes[0][1],'1000'); // no spawn coordinates go into storage
});
test('actual UI handler clears old routes on loading elsewhere and preserves manual choice',()=>{
 const h=harness(),{c,meta}=h;
 c.handleRaidEvent({kind:'raid-started',map:'customs',at:1000},meta);
 c.routeSession=RaidSession.choose(c.routeSession,c.DATA,'a');
 c.handleRaidEvent({kind:'spawn-position',map:'customs',at:4000,x:0,z:0},meta);
 assert.equal(c.routeSession.source,'manual');
 c.objectiveRoute={stops:[1]};
 c.handleRaidEvent({kind:'raid-loading',map:'woods',at:5000},meta);
 assert.equal(c.objectiveRoute,null);assert.equal(c.routeSession.start,null);
 const shown=c.toasts.at(-1);assert.equal(shown.title,'Loading into Woods');
 shown.actions[0].run();assert.equal(c.location.href,'woods.html#raid');
 c.handleRaidEvent({kind:'raid-loading',map:null,at:6000},meta);assert.equal(c.toasts.at(-1).title,'Unknown raid location');
 // Auto raid mode (on by default) follows the raid to its map, and opens raid mode on this map's loading screen.
 c.autoRaidOn=()=>true;c.location.href='';const shown2=c.toasts.length;
 c.handleRaidEvent({kind:'raid-loading',map:'woods',at:7000},meta);assert.equal(c.location.href,'woods.html#raid');assert.equal(c.toasts.length,shown2);
 let entered=0,restarted=0;c.enterRaid=()=>entered++;c.restartClock=()=>restarted++;
 c.handleRaidEvent({kind:'raid-loading',map:'customs',at:8000},meta);assert.equal(entered,1);assert.equal(restarted,1);
 assert.equal(h.timer,null);
});
